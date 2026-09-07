/* Packaged HTTP fallback; Blob workers use the same in-memory core. */
importScripts('color-field.js?v=87-native-fill');
self.onmessage=SkechuColorField.handleWorkerMessage;
