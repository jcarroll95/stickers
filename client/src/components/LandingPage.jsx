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
              <picture>
                  <source
                      type="image/webp"
                      srcSet="/assets/sb0-400w.webp 400w, /assets/sb0-800w.webp 800w"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
                  />
                  <img
                      src="/assets/sb0-800w.png"
                      srcSet="/assets/sb0-400w.png 400w, /assets/sb0-800w.png 800w"
                      sizes="(max-width: 600px) 400px, (max-width: 900px) 800px"
                      fetchpriority="high"
                      alt="Stickerboard Preview"
                      className={styles.heroImage}
                  />
              </picture>
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
        <h2 className={styles.sectionTitle}>Stickerboard Gallery</h2>
          <div className={styles.imageGrid}>
              <picture>
                  <source type="image/webp" srcSet="/assets/sb1-400w.webp 400w, /assets/sb1-800w.webp 800w"/>
                  <img src="/assets/sb1-800w.png" srcSet="/assets/sb1-400w.png 400w, /assets/sb1-800w.png 800w"
                       sizes="(max-width: 768px) 45vw, 400px" alt="Gallery 1" className={styles.gridImage}/>
              </picture>

              <picture>
                  <source type="image/webp" srcSet="/assets/sb5-400w.webp 400w, /assets/sb5-800w.webp 800w"/>
                  <img src="/assets/sb5-800w.png" srcSet="/assets/sb5-400w.png 400w, /assets/sb5-800w.png 800w"
                       sizes="(max-width: 768px) 45vw, 400px" alt="Gallery 2" className={styles.gridImage}/>
              </picture>

              <picture>
                  <source type="image/webp" srcSet="/assets/sb3-400w.webp 400w, /assets/sb3-800w.webp 800w"/>
                  <img src="/assets/sb3-800w.png" srcSet="/assets/sb3-400w.png 400w, /assets/sb3-800w.png 800w"
                       sizes="(max-width: 768px) 45vw, 400px" alt="Gallery 3" className={styles.gridImage}/>
              </picture>

              <picture>
                  <source type="image/webp" srcSet="/assets/sb4-400w.webp 400w, /assets/sb4-800w.webp 800w"/>
                  <img src="/assets/sb4-800w.png" srcSet="/assets/sb4-400w.png 400w, /assets/sb4-800w.png 800w"
                       sizes="(max-width: 768px) 45vw, 400px" alt="Gallery 4" className={styles.gridImage}/>
              </picture>
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
