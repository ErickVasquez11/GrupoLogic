/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Permite que la aplicación se compile en Vercel aunque haya errores de tipado de TypeScript.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Permite que la aplicación se compile aunque haya advertencias de formato de ESLint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;