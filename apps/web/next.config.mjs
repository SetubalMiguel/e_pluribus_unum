/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Expõe a URL da API para o cliente. Padrão local = http://localhost:8000.
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
