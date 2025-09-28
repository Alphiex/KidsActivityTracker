// React Native configuration for iOS simulator
module.exports = {
  // Default iOS simulator configuration
  // Using iOS 18.6 to avoid network issues with 18.4
  ios: {
    defaultSimulator: "iPhone 16 Pro", // Simulator name
    defaultUdid: "A8661E75-FE3E-483F-8F13-AC87110E8EE2", // iOS 18.6 iPhone 16 Pro

    // Alternative simulators (iOS 18.6)
    alternativeSimulators: [
      { name: "iPhone 16 Pro Max", udid: "9F3BA117-5391-4064-9FAF-8A7CA82CE93C" },
      { name: "iPhone 16", udid: "6558E69E-75D4-4088-B42B-DBD7F5FDFAFA" },
      { name: "iPhone 16 Plus", udid: "86E8B2CB-2E1B-4621-9A20-78549BDFB0F9" }
    ]
  }
};