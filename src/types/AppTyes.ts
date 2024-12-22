// types.ts

// Define the names of all apps in the system
export type AppName = 
  | 'finder'
  | 'music'
  | 'safari'
  | 'photos'
  | 'messages'
  | 'memo'
  | 'github'
  | 'blog'
  | 'notion'
  | 'mail'
  | 'share'
  | 'settings'
  | 'bin';

// Define the state of each app
export interface AppState {
  isRunning: boolean;  // Indicates if the app is running
  isMinimized: boolean; // Indicates if the app is minimized
}

// Define the context for managing apps
export interface AppContextType {
  apps: Record<AppName, AppState>;  // A record of app states, keyed by app names
  toggleApp: (appName: AppName) => void; // Function to toggle an app's state
}

// Define the properties for a DockItem component
export interface DockItemProps {
  icon: string;        // The URL of the app icon
  isActive: boolean;   // Whether the app is running (shown by an indicator)
  isHidden: boolean;   // Whether the app is hidden due to space constraints in the dock
  onClick: () => void; // Function to call when the DockItem is clicked
}
