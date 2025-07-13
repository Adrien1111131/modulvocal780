/**
 * Service pour gérer l'affichage aléatoire des images locales
 * Remplace le système de génération d'images Grok pour améliorer les performances
 */

class RandomImageService {
  constructor() {
    this.images = [];
    this.preloadedImages = new Map();
    this.currentImageIndex = -1;
    this.isLoaded = false;
  }

  /**
   * Initialise le service en chargeant la liste des images
   */
  async initialize() {
    try {
      const response = await fetch('/images/images-list.json');
      this.images = await response.json();
      await this.preloadImages();
      this.isLoaded = true;
      console.log(`Service d'images initialisé avec ${this.images.length} images`);
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service d\'images:', error);
    }
  }

  /**
   * Précharge toutes les images pour un affichage instantané
   */
  async preloadImages() {
    const preloadPromises = this.images.map(imageName => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.preloadedImages.set(imageName, img);
          resolve();
        };
        img.onerror = reject;
        img.src = `/images/${imageName}`;
      });
    });

    try {
      await Promise.all(preloadPromises);
      console.log('Toutes les images ont été préchargées');
    } catch (error) {
      console.warn('Certaines images n\'ont pas pu être préchargées:', error);
    }
  }

  /**
   * Sélectionne une image aléatoire différente de la précédente
   * @returns {string} Le nom du fichier image
   */
  getRandomImage() {
    if (!this.isLoaded || this.images.length === 0) {
      console.warn('Service d\'images non initialisé ou aucune image disponible');
      return null;
    }

    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * this.images.length);
    } while (newIndex === this.currentImageIndex && this.images.length > 1);

    this.currentImageIndex = newIndex;
    return this.images[newIndex];
  }

  /**
   * Obtient l'URL complète d'une image aléatoire
   * @returns {string} L'URL de l'image
   */
  getRandomImageUrl() {
    const imageName = this.getRandomImage();
    return imageName ? `/images/${imageName}` : null;
  }

  /**
   * Obtient une image préchargée aléatoire
   * @returns {HTMLImageElement|null} L'élément image préchargé
   */
  getRandomPreloadedImage() {
    const imageName = this.getRandomImage();
    return imageName ? this.preloadedImages.get(imageName) : null;
  }

  /**
   * Vérifie si le service est prêt
   * @returns {boolean}
   */
  isReady() {
    return this.isLoaded && this.images.length > 0;
  }

  /**
   * Obtient le nombre total d'images disponibles
   * @returns {number}
   */
  getImageCount() {
    return this.images.length;
  }
}

// Instance singleton
const randomImageService = new RandomImageService();

export default randomImageService;
