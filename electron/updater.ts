import { autoUpdater } from 'electron-updater';

export function setupAutoUpdater() {
    autoUpdater.checkForUpdatesAndNotify();
    
    autoUpdater.on('update-available', () => {
        console.log('Update available');
    });
    
    autoUpdater.on('update-downloaded', () => {
        console.log('Update downloaded');
    });
    
    autoUpdater.on('error', (error: Error) => {
        console.error('Auto-updater error:', error);
    });
}


