import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

/* Pages that aren't ours (the Cloudflare Access sign-in) are made for a normal browser and slide under the notch in the
   app. On any host other than jplundberg.com this pads the page by the phone's safe area (2026-11-22). Our own pages
   already do that themselves (viewport-fit=cover + env(safe-area-inset-*)). Used from Main.storyboard. */
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        let js = """
        (function () {
          if (/(^|\\.)jplundberg\\.com$/.test(location.hostname)) return;
          var m = document.querySelector('meta[name=viewport]');
          if (!m) { m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1'; document.head.appendChild(m); }
          if (!/viewport-fit/.test(m.content)) m.content += ',viewport-fit=cover';
          var s = document.createElement('style');
          s.textContent = 'html{padding-top:env(safe-area-inset-top)!important;padding-bottom:env(safe-area-inset-bottom)!important;box-sizing:border-box}';
          document.head.appendChild(s);
        })();
        """
        webView?.configuration.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
    }
}
