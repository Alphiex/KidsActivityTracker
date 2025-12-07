import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

const ModernColors = {
  primary: '#FF385C',
  text: '#222222',
  textLight: '#717171',
  border: '#DDDDDD',
  background: '#FFFFFF',
  surface: '#F7F7F7',
};

type LegalScreenType = 'privacy' | 'terms';

type RouteParams = {
  Legal: {
    type: LegalScreenType;
  };
};

const PRIVACY_POLICY_CONTENT = `
Last Updated: December 2024

KidsActivityTracker ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.

1. INFORMATION WE COLLECT

Personal Information You Provide:
• Account information (email address, name, password)
• Children's profiles (names, birthdates) that you choose to add
• Location preferences for activity searches
• Activity preferences and favorites

Information Collected Automatically:
• App usage data and analytics
• Device information (device type, operating system)

2. HOW WE USE YOUR INFORMATION

We use the information we collect to:
• Provide and maintain our services
• Personalize activity recommendations based on your children's ages
• Send notifications about activities you've saved
• Improve and optimize our app
• Communicate with you about updates and features

3. CHILDREN'S PRIVACY

KidsActivityTracker is designed for parents and guardians to find activities for their children. We do not knowingly collect personal information directly from children under 13.

Children's profiles are created and managed by adult account holders. The information stored (names and birthdates) is used solely to provide age-appropriate activity recommendations.

4. DATA SHARING

We do not sell your personal information. We may share information only:
• With your consent
• To comply with legal obligations
• To protect our rights and safety
• With service providers who assist in operating our app

5. DATA SECURITY

We implement appropriate security measures to protect your information:
• Encrypted data transmission (HTTPS)
• Secure password storage (hashed)
• Regular security audits

6. YOUR RIGHTS

You have the right to:
• Access your personal information
• Correct inaccurate information
• Delete your account and all associated data
• Opt-out of marketing communications

7. DATA RETENTION

We retain your information for as long as your account is active. When you delete your account, we permanently remove all your data within 30 days.

8. ACCOUNT DELETION

You can delete your account at any time through the app:
1. Go to Profile
2. Select "Delete Account"
3. Confirm with your password

This will permanently delete:
• Your account profile
• All children profiles
• Saved favorites
• Sharing settings
• All preferences

9. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy in the app and updating the "Last Updated" date.

10. CONTACT US

If you have questions about this Privacy Policy, please contact us at:
Email: privacy@kidsactivitytracker.com
`;

const TERMS_OF_SERVICE_CONTENT = `
Last Updated: December 2024

Please read these Terms of Service ("Terms") carefully before using KidsActivityTracker.

1. ACCEPTANCE OF TERMS

By accessing or using KidsActivityTracker, you agree to be bound by these Terms. If you disagree with any part of the terms, you may not access the service.

2. DESCRIPTION OF SERVICE

KidsActivityTracker is a mobile application that helps parents and guardians discover local activities, classes, and programs for their children. We aggregate activity information from various providers to help families find suitable options.

3. USER ACCOUNTS

• You must be 18 years or older to create an account
• You are responsible for maintaining the confidentiality of your account
• You are responsible for all activities that occur under your account
• You must provide accurate and complete information
• You must notify us immediately of any unauthorized use

4. USER RESPONSIBILITIES

You agree to:
• Use the service only for lawful purposes
• Not misuse or interfere with the service
• Not attempt to access areas of the service you are not authorized to access
• Not reproduce, duplicate, or copy any part of the service
• Provide accurate information about your children for activity recommendations

5. ACTIVITY INFORMATION

• Activity information is provided for informational purposes only
• We aggregate data from third-party providers
• We do not guarantee the accuracy, completeness, or availability of any activity
• Verify all information directly with activity providers before registering
• Pricing, availability, and schedules may change without notice

6. INTELLECTUAL PROPERTY

• The service and its original content are owned by KidsActivityTracker
• You may not use our trademarks without prior written consent
• User-generated content remains your property, but you grant us license to use it

7. LIMITATION OF LIABILITY

KidsActivityTracker shall not be liable for:
• Any indirect, incidental, or consequential damages
• Loss of profits, data, or use
• Interruption of service
• Actions or omissions of third-party activity providers

The service is provided "as is" without warranties of any kind.

8. INDEMNIFICATION

You agree to indemnify and hold harmless KidsActivityTracker and its officers, directors, employees, and agents from any claims, damages, or expenses arising from your use of the service or violation of these Terms.

9. TERMINATION

• You may terminate your account at any time by deleting it through the app
• We may terminate or suspend your account for violations of these Terms
• Upon termination, your right to use the service ceases immediately

10. ACCOUNT DELETION

You have the right to delete your account at any time. Account deletion will:
• Permanently remove all your personal data
• Remove all children profiles
• Remove all favorites and preferences
• This action cannot be undone

11. MODIFICATIONS TO TERMS

We reserve the right to modify these Terms at any time. We will notify users of significant changes through the app. Continued use after changes constitutes acceptance of the new Terms.

12. GOVERNING LAW

These Terms shall be governed by and construed in accordance with the laws of British Columbia, Canada, without regard to its conflict of law provisions.

13. DISPUTE RESOLUTION

Any disputes arising from these Terms or your use of the service shall be resolved through:
• Good faith negotiation
• Mediation if negotiation fails
• Binding arbitration as a last resort

14. SEVERABILITY

If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in effect.

15. CONTACT US

For questions about these Terms, please contact us at:
Email: legal@kidsactivitytracker.com
`;

const LegalScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'Legal'>>();

  const type = route.params?.type || 'privacy';
  const isPrivacy = type === 'privacy';

  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const content = isPrivacy ? PRIVACY_POLICY_CONTENT : TERMS_OF_SERVICE_CONTENT;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color={ModernColors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.content}>{content}</Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            If you have any questions, please contact us at support@kidsactivitytracker.com
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ModernColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ModernColors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: ModernColors.text,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    color: ModernColors.text,
  },
  footer: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: ModernColors.border,
  },
  footerText: {
    fontSize: 14,
    color: ModernColors.textLight,
    textAlign: 'center',
  },
});

export default LegalScreen;
