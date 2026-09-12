# Camera Card Scanner Feature

## Overview

The Riftbound Card Cataloger now includes a camera-based card scanning feature that allows mobile users to quickly add cards to their collection by scanning the card ID from the bottom-left corner of physical cards.

## Features

- **Real-time Camera Scanning**: Uses device camera with live preview
- **Automatic Card ID Detection**: Extracts card IDs using OCR (Optical Character Recognition)
- **Mobile-Optimized**: Uses rear-facing camera on mobile devices
- **Seamless Integration**: Automatically adds detected cards to collection
- **Manual Override**: Can still use manual entry if camera scanning fails

## How It Works

### Technical Implementation

1. **Camera Access**: Uses the browser's `getUserMedia` API to access the device camera
2. **Image Processing**: Captures video frames and processes them with Tesseract.js OCR
3. **Region Detection**: Crops the bottom-left region where card IDs are typically located
4. **Pattern Matching**: Uses regex to extract card IDs in the format `LETTERS-NUMBERS` or `LETTERS-NUMBERS-NUMBERS`
5. **Auto-Add**: Automatically adds detected cards to the user's collection

### Card ID Pattern

The scanner looks for card IDs matching these patterns:
- `OGN-039` (Set-Number)
- `VEN-131` (Set-Number)
- `OGN-039-298` (Set-Number-Number)

### Scanning Region

The scanner focuses on:
- **Location**: Bottom-left corner of the card
- **Width**: 30% of the frame width
- **Height**: 15% of the frame height

This region is highlighted with a purple dashed border in the camera view.

## Usage

### On the Add Cards Page

1. Navigate to the "Add Cards" page
2. Click the blue "Scan" button (camera icon) next to the Add button
3. Allow camera access when prompted
4. Position your card so the ID in the bottom-left corner is visible in the purple scanning region
5. Hold steady while the scanner processes the image
6. The card will be automatically detected and added to your collection
7. The scanner will close and you can continue scanning more cards

### Tips for Best Results

- **Good Lighting**: Ensure the card is well-lit
- **Steady Hand**: Hold the device steady while scanning
- **Clear View**: Make sure the card ID is not obscured
- **Proper Angle**: Hold the camera perpendicular to the card
- **Focus**: Ensure the card is in focus (not blurry)

## Permissions

### Browser Permissions

The scanner requires camera permission from the browser:
- **First Use**: Browser will prompt for camera access
- **Denied**: If denied, you'll see an error message with instructions to enable camera in browser settings
- **No Camera**: If no camera is available, you'll be prompted to use manual entry

### Mobile Devices

On mobile devices:
- Uses the rear-facing camera by default
- Works in both portrait and landscape orientation
- Optimized for typical mobile camera resolutions

## Error Handling

### Common Errors

1. **Camera Permission Denied**
   - **Cause**: User denied camera access
   - **Solution**: Enable camera in browser settings and reload the page

2. **No Camera Found**
   - **Cause**: Device has no camera or camera is not accessible
   - **Solution**: Use manual entry instead

3. **Card ID Not Detected**
   - **Cause**: Poor lighting, blurry image, or card ID not in scanning region
   - **Solution**: Adjust positioning, improve lighting, or use manual entry

4. **Invalid Card ID Format**
   - **Cause**: OCR extracted text that doesn't match expected card ID format
   - **Solution**: Scanner will continue scanning; adjust card position

### Error Messages

The scanner provides clear error messages:
- "Camera permission denied. Please allow camera access in your browser settings."
- "No camera found. Please connect a camera or use manual entry."
- "Camera error: [specific error message]"
- "Failed to access camera. Please check permissions."

## Performance

### Processing Speed

- **Frame Rate**: Scans approximately once per second
- **OCR Processing**: 1-3 seconds per frame (depending on device)
- **Total Time**: Typically 2-5 seconds from positioning to detection

### Resource Usage

- **Memory**: Tesseract.js loads language data (~2-3 MB)
- **CPU**: Moderate CPU usage during OCR processing
- **Battery**: Camera and OCR processing consume battery; close scanner when not in use

### Optimization

The scanner is optimized for:
- Mobile devices with limited resources
- Quick detection without excessive processing
- Minimal battery drain during extended scanning sessions

## Browser Compatibility

### Supported Browsers

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (iOS 11+)
- **Mobile Browsers**: Chrome Mobile, Safari Mobile, Firefox Mobile

### Requirements

- HTTPS connection (required for camera access)
- Modern browser with `getUserMedia` support
- JavaScript enabled
- Camera hardware available

### Not Supported

- Internet Explorer
- Older mobile browsers without camera API support
- HTTP connections (camera access requires HTTPS)

## Integration with Existing Features

### Card Lookup Service

The scanner integrates seamlessly with the existing card lookup service:
1. Camera detects card ID
2. Card ID is passed to `getCardById()` function
3. Card data is fetched from the API (or cache)
4. Card is added to collection via `addCardToCollection()`

### Collection Management

Scanned cards are treated the same as manually entered cards:
- Added to user's collection in Firestore
- Quantity incremented if card already exists
- Shows in collection history
- Triggers collection updates across the app

### Caching

Scanned cards benefit from the existing caching system:
- Card data is cached after first lookup
- Subsequent scans of the same card are instant
- Reduces API calls and improves performance

## Future Enhancements

Potential improvements for future versions:

1. **Batch Scanning**: Scan multiple cards in sequence without closing camera
2. **Improved OCR**: Better text recognition for worn or damaged cards
3. **Card Image Recognition**: Identify cards by artwork instead of just text
4. **Offline Support**: Cache OCR models for offline scanning
5. **Flashlight Support**: Enable device flashlight for better lighting
6. **QR Code Support**: Scan QR codes if cards include them
7. **Multi-language Support**: Support for non-English card text

## Troubleshooting

### Scanner Not Opening

1. Check browser permissions for camera access
2. Ensure you're using HTTPS (not HTTP)
3. Try a different browser
4. Check if another app is using the camera
5. Restart the browser

### Cards Not Being Detected

1. Improve lighting conditions
2. Hold the card steady
3. Position the card ID in the purple scanning region
4. Ensure the card is in focus
5. Try manual entry as an alternative

### Slow Performance

1. Close other browser tabs to free up resources
2. Use a device with better hardware
3. Ensure good lighting to reduce OCR processing time
4. Close the scanner when not actively scanning

### Camera Shows Black Screen

1. Check if camera is being used by another application
2. Restart the browser
3. Check device camera permissions in system settings
4. Try a different camera (if multiple available)

## Privacy and Security

### Data Handling

- **Camera Feed**: Processed locally on device, never sent to servers
- **OCR Processing**: Done client-side using Tesseract.js
- **Card IDs**: Only sent to the card database API for lookup
- **No Storage**: Camera images are not stored or saved

### Permissions

- Camera access is requested only when user clicks "Scan" button
- User can deny permission and use manual entry instead
- Camera is automatically closed when scanner is closed or card is detected

## Accessibility

### Keyboard Navigation

- Scanner can be closed with Escape key
- Camera button is focusable and activatable with keyboard
- Manual entry remains fully accessible

### Screen Readers

- Camera button has descriptive title: "Scan card with camera"
- Error messages are announced to screen readers
- Status updates are provided during scanning

### Visual Indicators

- Purple scanning region clearly shows where to position card
- Status text provides real-time feedback
- Loading indicators show when processing

## Code Structure

### Files

- `src/components/CameraScanner.tsx`: Main camera scanner component
- `src/pages/AddCardsPage.tsx`: Integration with Add Cards page
- `src/services/cardLookupService.ts`: Card lookup (existing)
- `src/services/collectionService.ts`: Collection management (existing)

### Dependencies

- `tesseract.js`: OCR library for text recognition
- Browser APIs: `getUserMedia`, `Canvas`, `MediaStream`

### Component Props

```typescript
interface CameraScannerProps {
  onCardIdDetected: (cardId: string) => void;
  onClose: () => void;
}
```

## Testing

### Manual Testing Checklist

- [ ] Camera permission prompt appears
- [ ] Camera feed displays correctly
- [ ] Scanning region is visible
- [ ] Card ID is detected from physical card
- [ ] Detected card is added to collection
- [ ] Scanner closes after detection
- [ ] Error handling works for denied permissions
- [ ] Manual entry still works when camera unavailable
- [ ] Works on mobile devices (iOS and Android)
- [ ] Works on desktop with webcam

### Automated Testing

Consider adding tests for:
- Card ID regex pattern matching
- OCR result parsing
- Error handling scenarios
- Component rendering

## Support

For issues or questions about the camera scanner:

1. Check browser console for error messages
2. Verify camera permissions in browser settings
3. Ensure HTTPS connection
4. Try a different browser or device
5. Fall back to manual entry if needed

## Conclusion

The camera scanner feature significantly improves the mobile user experience by allowing quick, hands-free card entry. While it requires camera permissions and works best with good lighting, it provides a seamless way to build your collection from physical cards.
