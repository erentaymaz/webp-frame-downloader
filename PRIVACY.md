# Privacy Policy — WebP Frame Downloader

Last updated: 8 October 2026

WebP Frame Downloader is a browser extension that detects sequential WebP animation frames on the web page you are viewing and downloads them.

## Data collection

The extension does not collect, store or transmit any personal data. There are no analytics, no tracking, no accounts and no server operated by the developer.

## What the extension accesses

- **The page you clicked on.** When you click the extension icon, it reads the image URLs of the current tab to find frame sequences. Nothing is sent anywhere.
- **The site hosting the frames.** To check which frames exist and to download them, the extension sends requests to that site only. These are the same requests your browser makes when it displays the images.
- **Your Downloads folder, or a folder you choose.** Frames are written there. The extension never reads other files.

## Permissions

- `activeTab`, `scripting`: scan the tab where you clicked the icon.
- `downloads`: save frames to the Downloads folder.
- Optional site access: requested at runtime, only for the site involved, when you use Deep scan or Save to folder. It is not requested at install time.

## Settings

The only setting is the interface language (English or Turkish). It is stored locally in your browser and never leaves your device.

## Contact

Questions or concerns: open an issue at https://github.com/erentaymaz/webp-frame-downloader/issues
