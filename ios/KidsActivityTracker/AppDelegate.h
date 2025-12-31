#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>
#import <FirebaseMessaging/FirebaseMessaging.h>

// Suppress deprecation warning for RCTAppDelegate
// TODO: Migrate to RCTReactNativeFactory when upgrading React Native
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
#import <RCTAppDelegate.h>
#pragma clang diagnostic pop

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate, FIRMessagingDelegate>

@end