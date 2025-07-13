declare class RandomImageService {
  constructor();
  initialize(): Promise<void>;
  preloadImages(): Promise<void>;
  getRandomImage(): string | null;
  getRandomImageUrl(): string | null;
  getRandomPreloadedImage(): HTMLImageElement | null;
  isReady(): boolean;
  getImageCount(): number;
}

declare const randomImageService: RandomImageService;
export default randomImageService;
