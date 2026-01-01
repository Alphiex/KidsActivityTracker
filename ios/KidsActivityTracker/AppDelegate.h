#import <UIKit/UIKit.h>
#import <UserNotifications/UNUserNotificationCenter.h>

// Forward declaration for Firebase Messaging
@protocol FIRMessagingDelegate;

// React Native App Delegate
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
#if __has_include(<React_RCTAppDelegate/RCTAppDelegate.h>)
#import <React_RCTAppDelegate/RCTAppDelegate.h>
#elif __has_include(<React-RCTAppDelegate/RCTAppDelegate.h>)
#import <React-RCTAppDelegate/RCTAppDelegate.h>
#else
#import <RCTAppDelegate.h>
#endif
#pragma clang diagnostic pop

@interface AppDelegate : RCTAppDelegate <UNUserNotificationCenterDelegate, FIRMessagingDelegate>

@end