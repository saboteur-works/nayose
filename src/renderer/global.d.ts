import type { NayoseApi } from '../main/preload';

declare global {
  interface Window {
    nayose: NayoseApi;
  }
}

export {};
