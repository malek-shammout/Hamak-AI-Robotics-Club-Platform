import localFont from 'next/font/local';

/**
 * claude.md 8 - Madani is primary for ALL UI text (Arabic and Latin);
 * Minecraft PE is accent-only: big numerals and tech flourishes.
 * Never Minecraft for body copy, never for Arabic.
 *
 * Source archives: D:\HMK Robotics club\Hmk robotic fonts\
 * Extracted TTFs live in src/fonts/ and are self-hosted via next/font/local,
 * so there is no third-party font request at runtime.
 */

export const madani = localFont({
  src: [
    {path: '../fonts/Madani-Regular.ttf', weight: '400', style: 'normal'},
    {path: '../fonts/Madani-Medium.ttf', weight: '500', style: 'normal'},
    {path: '../fonts/Madani-SemiBold.ttf', weight: '600', style: 'normal'},
    {path: '../fonts/Madani-Bold.ttf', weight: '700', style: 'normal'},
  ],
  variable: '--font-madani',
  display: 'swap',
  fallback: ['Segoe UI', 'system-ui', 'sans-serif'],
});

export const minecraft = localFont({
  src: [{path: '../fonts/MinecraftPE.ttf', weight: '400', style: 'normal'}],
  variable: '--font-minecraft',
  display: 'swap',
  fallback: ['Courier New', 'monospace'],
  preload: false,
});
