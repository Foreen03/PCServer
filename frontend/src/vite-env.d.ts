/// <reference types="vite/client" />

// declare global {
//   interface Window {
//     external: {
//       sendMessage: (message: string) => void;
//       receiveMessage: (callback: (message: string) => void) => void;
//     };
//   }
// }

interface External {
  sendMessage: (message: string) => void;
  receiveMessage: (callback: (message: string) => void) => void;
}
