import React from 'react';
import styles from './LandingPage.module.css';

const LandingPage = () => {
  const handleGetStarted = () => {
    window.location.hash = '#/register';
  };

  const handleExplore = () => {
    window.location.hash = '#/explore';
  };

  return (
    <div className={styles.landingContainer}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Your GLP-1 Journey, <span className={styles.highlight}>Digitized</span></h1>
          <p className={styles.subtitle}>
            Create, collect, and share your digital stickerboards while logging your shots. A new way to express yourself and organize your inspirations, give and receive support, and connect with others on your journey.
          </p>
          <div className={styles.ctaButtons}>
            <button className={styles.primaryButton} onClick={handleGetStarted}>
              Get Started for Free
            </button>
            <button className={styles.secondaryButton} onClick={handleExplore}>
              Explore Boards
            </button>
          </div>
        </div>
        <div className={styles.heroImageContainer}>
          <img src="/assets/sb0.png" alt="Stickerboard Preview" className={styles.heroImage} />
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>Why Stickerboards?</h2>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎨</div>
            <h3>Infinite Canvas</h3>
            <p>A motivational visual canvas to express yourself and log your GLP-1 doses.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>✨</div>
            <h3>Unique Stickers</h3>
            <p>Choose from thousands of artist-designed stickers or upload your own.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Collaborate</h3>
            <p>Share your boards with friends and build collections together in real-time.</p>
          </div>
        </div>
      </section>

      {/* Showcase Section */}
      <section className={styles.showcase}>
        <h2 className={styles.sectionTitle}>Inspiration Gallery</h2>
        <div className={styles.imageGrid}>
          <img src="/assets/sb1.png" alt="Gallery 1" className={styles.gridImage} />
          <img src="/assets/sb2.png" alt="Gallery 2" className={styles.gridImage} />
          <img src="/assets/sb3.png" alt="Gallery 3" className={styles.gridImage} />
          <img src="/assets/sb4.png" alt="Gallery 4" className={styles.gridImage} />
        </div>
      </section>

      {/* Footer CTA */}
      <section className={styles.footerCta}>
        <h2>Ready to start sticking?</h2>
        <button className={styles.primaryButton} onClick={handleGetStarted}>
          Create Your First Board
        </button>
      </section>

      <footer className={styles.footer}>
        <p>&copy; {new Date().getFullYear()} Stickerboards. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
