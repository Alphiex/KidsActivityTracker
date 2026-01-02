/**
 * AutoFixPipeline.js
 *
 * Orchestrates the complete auto-fix workflow:
 * 1. Analyze validation discrepancies
 * 2. Determine fix routing (platform vs provider-specific)
 * 3. Capture HTML from problem pages
 * 4. Discover selectors using Claude
 * 5. Validate fixes on sample pages
 * 6. Apply patches to correct scraper files
 */

const DiscrepancyAnalyzer = require('./DiscrepancyAnalyzer');
const HTMLCapture = require('./HTMLCapture');
const SelectorDiscoveryAgent = require('./SelectorDiscoveryAgent');
const ScraperPatcher = require('./ScraperPatcher');
const FixValidator = require('./FixValidator');
const PlatformAnalyzer = require('./PlatformAnalyzer');
const fs = require('fs').promises;
const path = require('path');

class AutoFixPipeline {
  constructor(options = {}) {
    this.options = options;

    // Initialize components
    this.analyzer = new DiscrepancyAnalyzer(options.analyzer);
    this.htmlCapture = new HTMLCapture(options.htmlCapture);
    this.selectorAgent = new SelectorDiscoveryAgent(options.selectorAgent);
    this.patcher = new ScraperPatcher(options.patcher);
    this.validator = new FixValidator(options.validator);
    this.platformAnalyzer = new PlatformAnalyzer(options.platformAnalyzer);

    // Pipeline options
    this.maxFieldsToFix = options.maxFieldsToFix || 5;
    this.minConfidence = options.minConfidence || 60;
    this.dryRun = options.dryRun !== false; // Default to dry run for safety
    this.requireValidation = options.requireValidation !== false;

    // Results storage
    this.outputDir = options.outputDir || path.join(__dirname, 'autofix-results');
  }

  /**
   * Run the complete auto-fix pipeline
   * @param {Object} options - Pipeline options
   * @returns {Promise<Object>} Pipeline results
   */
  async run(options = {}) {
    const {
      platform = null, // Specific platform to fix, or null for all
      field = null, // Specific field to fix, or null for all
      maxFixes = this.maxFieldsToFix,
      dryRun = this.dryRun,
    } = options;

    const startTime = Date.now();
    const results = {
      startTime: new Date().toISOString(),
      options: { platform, field, maxFixes, dryRun },
      stages: {},
      fixes: [],
      summary: {},
    };

    try {
      // Stage 1: Analyze discrepancies
      console.log('\n📊 Stage 1: Analyzing validation discrepancies...');
      const analysis = await this.analyzer.analyze();
      results.stages.analysis = {
        success: true,
        patterns: analysis.patterns.length,
        totalDiscrepancies: analysis.summary.totalDiscrepancies,
      };
      console.log(`   Found ${analysis.patterns.length} patterns from ${analysis.summary.totalDiscrepancies} discrepancies`);

      // Get fix targets
      let fixTargets = this.analyzer.getFixTargets(analysis);

      // Filter by platform if specified
      if (platform) {
        fixTargets = fixTargets.filter(t =>
          t.provider?.toLowerCase().includes(platform.toLowerCase()) ||
          t.samples?.some(s => s.provider?.toLowerCase().includes(platform.toLowerCase()))
        );
      }

      // Filter by field if specified
      if (field) {
        fixTargets = fixTargets.filter(t => t.field === field);
      }

      // Limit number of fixes
      fixTargets = fixTargets.slice(0, maxFixes);

      if (fixTargets.length === 0) {
        console.log('   No fixable issues found.');
        results.summary = { message: 'No fixable issues found' };
        return results;
      }

      console.log(`   Selected ${fixTargets.length} fields to fix: ${fixTargets.map(t => t.field).join(', ')}`);

      // Stage 1.5: Determine fix routing (platform vs provider-specific)
      console.log('\n🎯 Stage 1.5: Analyzing fix routing...');
      const routingPlan = await this.platformAnalyzer.generateFixRoutingPlan(analysis);
      results.stages.routing = {
        platformFixes: routingPlan.platformFixes.length,
        providerFixes: routingPlan.providerFixes.length,
        manualReview: routingPlan.manualReview.length,
      };
      console.log(`   Platform-level: ${routingPlan.platformFixes.length}, Provider-specific: ${routingPlan.providerFixes.length}, Manual: ${routingPlan.manualReview.length}`);

      // Show routing plan details
      if (routingPlan.platformFixes.length > 0) {
        console.log('   Platform fixes:');
        for (const fix of routingPlan.platformFixes) {
          console.log(`     • ${fix.field} → ${path.basename(fix.targetFile)} (${Math.round(fix.affectedRatio * 100)}% of ${fix.platform})`);
        }
      }
      if (routingPlan.providerFixes.length > 0) {
        console.log('   Provider fixes:');
        for (const fix of routingPlan.providerFixes.slice(0, 5)) {
          console.log(`     • ${fix.field} → ${fix.provider} extension`);
        }
        if (routingPlan.providerFixes.length > 5) {
          console.log(`     ... and ${routingPlan.providerFixes.length - 5} more`);
        }
      }

      // Store routing plan for later use
      results.routingPlan = routingPlan;

      // Stage 2: Capture HTML from sample pages
      console.log('\n🌐 Stage 2: Capturing HTML from sample pages...');
      const htmlSamples = await this.captureHTMLSamples(fixTargets, analysis);
      results.stages.htmlCapture = {
        success: true,
        pagesCaptures: Object.values(htmlSamples).flat().length,
      };
      console.log(`   Captured HTML from ${Object.values(htmlSamples).flat().length} pages`);

      // Stage 3: Discover selectors
      console.log('\n🔍 Stage 3: Discovering selectors with Claude...');
      const discoveries = await this.discoverSelectors(fixTargets, htmlSamples);
      results.stages.selectorDiscovery = {
        success: true,
        discovered: discoveries.filter(d => d.success && d.found !== false).length,
        failed: discoveries.filter(d => !d.success || d.found === false).length,
      };
      console.log(`   Discovered ${results.stages.selectorDiscovery.discovered} selectors`);

      // Stage 4: Validate fixes
      if (this.requireValidation) {
        console.log('\n✅ Stage 4: Validating fixes...');
        const validationResults = await this.validateFixes(discoveries, fixTargets, analysis);
        results.stages.validation = {
          success: true,
          valid: validationResults.validFixes.length,
          invalid: validationResults.invalidFixes.length,
        };
        console.log(`   Valid: ${validationResults.validFixes.length}, Invalid: ${validationResults.invalidFixes.length}`);

        // Only use valid fixes
        results.fixes = validationResults.validFixes;
      } else {
        results.fixes = discoveries.filter(d => d.success && d.confidence >= this.minConfidence);
      }

      // Stage 5: Apply patches with smart routing
      if (results.fixes.length > 0) {
        console.log(`\n🔧 Stage 5: Applying patches${dryRun ? ' (DRY RUN)' : ''}...`);
        const patchResults = await this.applyFixes(results.fixes, dryRun, routingPlan);
        results.stages.patching = patchResults;
        console.log(`   Patched ${patchResults.patchedCount} fields`);
        if (patchResults.skipped.length > 0) {
          console.log(`   Skipped ${patchResults.skipped.length} (need manual intervention)`);
        }
      } else {
        console.log('\n⚠️  No valid fixes to apply');
        results.stages.patching = { skipped: true, reason: 'No valid fixes' };
      }

      // Generate summary
      results.summary = this.generateSummary(results);
      results.endTime = new Date().toISOString();
      results.duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      // Save results
      await this.saveResults(results);

      // Print summary
      this.printSummary(results);

      return results;

    } catch (error) {
      results.error = error.message;
      results.stack = error.stack;
      console.error('\n❌ Pipeline error:', error.message);
      return results;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Capture HTML samples for each fix target
   */
  async captureHTMLSamples(fixTargets, analysis) {
    const htmlSamples = {};

    for (const target of fixTargets) {
      // Shuffle and take random samples each run
      let urls = this.shuffleArray(target.sampleUrls || []).slice(0, 3);

      if (urls.length === 0) {
        urls = this.shuffleArray(target.samples?.map(s => s.sourceUrl).filter(Boolean) || []).slice(0, 3);
      }

      if (urls.length === 0) {
        // Try to get URLs from analysis (also shuffled)
        const fieldDetails = analysis.discrepancyDetails?.filter(d =>
          d.field === target.field &&
          (!target.provider || d.provider === target.provider)
        ) || [];

        urls = this.shuffleArray(fieldDetails.map(d => d.sourceUrl).filter(Boolean)).slice(0, 3);
      }

      if (urls.length === 0) {
        console.log(`   ⚠️  No URLs found for field: ${target.field}`);
        continue;
      }

      console.log(`   Capturing ${urls.length} pages for ${target.field}...`);

      const captures = await this.htmlCapture.captureMany(urls, {
        concurrency: 1,
        delayBetween: 1000,
      });

      htmlSamples[target.field] = captures.filter(c => c.success).map((c, i) => ({
        ...c,
        expectedValue: target.samples?.[i]?.expected,
        activityName: target.samples?.[i]?.activityName,
      }));
    }

    return htmlSamples;
  }

  /**
   * Discover selectors for each field
   */
  async discoverSelectors(fixTargets, htmlSamples) {
    const discoveries = [];

    for (const target of fixTargets) {
      const samples = htmlSamples[target.field];

      if (!samples || samples.length === 0) {
        discoveries.push({
          field: target.field,
          success: false,
          error: 'No HTML samples available',
        });
        continue;
      }

      console.log(`   Analyzing ${target.field}...`);

      // Prepare samples for selector discovery
      const selectorSamples = samples.map(s => ({
        html: s.mainContent || s.fullHtml,
        expectedValue: s.expectedValue,
        activityName: s.activityName,
      }));

      const discovery = await this.selectorAgent.discoverSelectorFromSamples(
        selectorSamples,
        target.field,
        { platform: target.provider }
      );

      discoveries.push({
        ...discovery,
        provider: target.provider,
      });

      // Log result
      if (discovery.success && discovery.selector) {
        console.log(`   ✓ ${target.field}: ${discovery.selector} (${discovery.confidence}% confidence)`);
      } else {
        console.log(`   ✗ ${target.field}: Could not find selector`);
      }
    }

    return discoveries;
  }

  /**
   * Validate discovered fixes
   */
  async validateFixes(discoveries, fixTargets, analysis) {
    const validFixes = [];
    const invalidFixes = [];

    for (const discovery of discoveries) {
      if (!discovery.success || !discovery.selector) {
        invalidFixes.push({
          ...discovery,
          reason: 'No selector discovered',
        });
        continue;
      }

      // Find sample URLs for this field
      const target = fixTargets.find(t => t.field === discovery.field);
      const samples = analysis.discrepancyDetails
        ?.filter(d => d.field === discovery.field)
        .map(d => ({
          sourceUrl: d.sourceUrl,
          expectedValue: d.expected,
        }))
        .slice(0, 5) || [];

      if (samples.length === 0) {
        // Skip validation if no samples, but still consider it valid if confidence is high
        if (discovery.confidence >= 80) {
          validFixes.push(discovery);
        } else {
          invalidFixes.push({
            ...discovery,
            reason: 'No validation samples available',
          });
        }
        continue;
      }

      console.log(`   Validating ${discovery.field}...`);

      const validation = await this.validator.validateFix(discovery, samples);

      if (validation.isValid) {
        validFixes.push({
          ...discovery,
          validation,
        });
        console.log(`   ✓ ${discovery.field}: ${Math.round(validation.accuracy * 100)}% accuracy`);
      } else {
        invalidFixes.push({
          ...discovery,
          validation,
          reason: `Low accuracy: ${Math.round(validation.accuracy * 100)}%`,
        });
        console.log(`   ✗ ${discovery.field}: ${Math.round(validation.accuracy * 100)}% accuracy (below threshold)`);
      }
    }

    return { validFixes, invalidFixes };
  }

  /**
   * Apply validated fixes to scrapers using smart routing
   * Routes fixes to platform base scraper or provider extension based on scope analysis
   */
  async applyFixes(fixes, dryRun, routingPlan = null) {
    const results = {
      patchedCount: 0,
      failedCount: 0,
      platformPatches: [],
      providerPatches: [],
      skipped: [],
    };

    // If we have a routing plan, use it for smart routing
    if (routingPlan) {
      // Apply platform-level fixes (affects >50% of providers on that platform)
      for (const platformFix of routingPlan.platformFixes) {
        const matchingFix = fixes.find(f => f.field === platformFix.field);
        if (!matchingFix) {
          results.skipped.push({
            field: platformFix.field,
            reason: 'No valid selector discovered',
            scope: 'platform',
          });
          continue;
        }

        console.log(`   [PLATFORM] ${platformFix.field} → ${path.basename(platformFix.targetFile)}`);

        const patchResult = await this.patcher.applyPatches(
          platformFix.platform,
          [{ ...matchingFix, targetFile: platformFix.targetFile }],
          { dryRun }
        );

        // Check if patch was skipped (already exists)
        const wasSkipped = patchResult.patches?.some(p => p.skipped) ||
                          patchResult.skipped;

        if (wasSkipped) {
          console.log(`     ⊘ Skipped (already patched)`);
          results.skipped.push({
            field: platformFix.field,
            reason: 'Already patched',
            scope: 'platform',
          });
        } else if (patchResult.success) {
          results.patchedCount++;
          results.platformPatches.push({
            field: platformFix.field,
            platform: platformFix.platform,
            file: platformFix.targetFile,
            affectedProviders: platformFix.affectedProviders.length,
          });
          console.log(`     ✓ Patched (affects ${platformFix.affectedProviders.length} providers)`);
          if (patchResult.backupPath && !dryRun) {
            console.log(`     Backup: ${patchResult.backupPath}`);
          }
        } else {
          results.failedCount++;
          console.log(`     ✗ Failed: ${patchResult.error || 'Unknown error'}`);
        }
      }

      // Apply provider-specific fixes (affects <50% of providers)
      for (const providerFix of routingPlan.providerFixes) {
        const matchingFix = fixes.find(f => f.field === providerFix.field);
        if (!matchingFix) continue;

        console.log(`   [PROVIDER] ${providerFix.field} → ${providerFix.provider} extension`);

        if (!providerFix.hasExtension) {
          // Would need to create a new extension file
          results.skipped.push({
            field: providerFix.field,
            provider: providerFix.provider,
            reason: 'Extension file does not exist (would need to create)',
            scope: 'provider',
            suggestedPath: providerFix.extensionPath,
          });
          console.log(`     ⚠️  Skipped: Extension file needs to be created`);
          console.log(`       Suggested: ${providerFix.extensionPath}`);
          continue;
        }

        // Apply to existing extension
        const patchResult = await this.patcher.applyPatchToFile(
          providerFix.extensionPath,
          { ...matchingFix, field: providerFix.field },
          { dryRun }
        );

        if (patchResult?.success) {
          results.patchedCount++;
          results.providerPatches.push({
            field: providerFix.field,
            provider: providerFix.provider,
            file: providerFix.extensionPath,
          });
          console.log(`     ✓ Patched extension`);
        } else {
          results.failedCount++;
          console.log(`     ✗ Failed: ${patchResult?.error || 'Unknown error'}`);
        }
      }

      // Report items needing manual review
      if (routingPlan.manualReview.length > 0) {
        console.log(`\n   ⚠️  ${routingPlan.manualReview.length} issues need manual review:`);
        for (const item of routingPlan.manualReview.slice(0, 3)) {
          console.log(`     • ${item.field} on ${item.platform}: ${item.recommendation}`);
        }
      }

    } else {
      // Fallback to old behavior if no routing plan
      const fixesByPlatform = {};
      for (const fix of fixes) {
        const platform = fix.provider || 'unknown';
        if (!fixesByPlatform[platform]) {
          fixesByPlatform[platform] = [];
        }
        fixesByPlatform[platform].push(fix);
      }

      for (const [platform, platformFixes] of Object.entries(fixesByPlatform)) {
        console.log(`   Patching ${platform}...`);
        const patchResult = await this.patcher.applyPatches(platform, platformFixes, { dryRun });

        if (patchResult.success) {
          results.patchedCount += patchResult.patchedFields.length;
          results.platformPatches.push({
            platform,
            fields: patchResult.patchedFields,
          });
          console.log(`   ✓ ${platform}: Patched ${patchResult.patchedFields.join(', ')}`);
        } else {
          results.failedCount++;
          console.log(`   ✗ ${platform}: ${patchResult.error || 'Failed'}`);
        }
      }
    }

    return results;
  }

  /**
   * Generate pipeline summary
   */
  generateSummary(results) {
    const { stages, fixes } = results;

    return {
      patternsFound: stages.analysis?.patterns || 0,
      selectorsDiscovered: stages.selectorDiscovery?.discovered || 0,
      fixesValidated: stages.validation?.valid || fixes.length,
      fixesApplied: stages.patching?.patchedCount || 0,
      apiCost: this.selectorAgent.getUsageStats(),
      fields: fixes.map(f => ({
        field: f.field,
        selector: f.selector,
        confidence: f.confidence,
        provider: f.provider,
      })),
    };
  }

  /**
   * Print summary to console
   */
  printSummary(results) {
    console.log('\n' + '═'.repeat(60));
    console.log('                    AUTO-FIX PIPELINE SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Duration: ${results.duration}`);
    console.log(`Mode: ${results.options.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    const s = results.summary;
    console.log(`Patterns Analyzed:     ${s.patternsFound}`);
    console.log(`Selectors Discovered:  ${s.selectorsDiscovered}`);
    console.log(`Fixes Validated:       ${s.fixesValidated}`);
    console.log(`Fixes Applied:         ${s.fixesApplied}`);
    console.log('');

    if (s.fields?.length > 0) {
      console.log('Fixed Fields:');
      for (const f of s.fields) {
        console.log(`  • ${f.field} (${f.provider || 'unknown'}): ${f.selector}`);
      }
    }

    console.log('');
    console.log(`API Cost: $${s.apiCost?.totalCost?.toFixed(4) || '0.00'}`);
    console.log('═'.repeat(60));
  }

  /**
   * Save results to file
   */
  async saveResults(results) {
    await fs.mkdir(this.outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `autofix-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${filepath}`);

    return filepath;
  }

  /**
   * Run in analyze-only mode (no patching)
   */
  async analyzeOnly() {
    console.log('\n📊 Running analysis only...\n');

    const analysis = await this.analyzer.analyze();
    console.log(this.analyzer.generateReport(analysis));

    return analysis;
  }

  /**
   * Preview what would be fixed
   */
  async preview(options = {}) {
    return this.run({ ...options, dryRun: true });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.htmlCapture.close();
    await this.validator.close();
  }
}

module.exports = AutoFixPipeline;
