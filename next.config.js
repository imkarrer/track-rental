/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // MinIO (local development)
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      // Vercel Blob (production)
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
      // Production S3-compatible storage (AWS S3, Cloudflare R2, etc.)
      // Add your production storage domain here when deploying
      // Example for AWS S3:
      // {
      //   protocol: 'https',
      //   hostname: 'your-bucket.s3.amazonaws.com',
      //   pathname: '/**',
      // },
      // Example for Cloudflare R2:
      // {
      //   protocol: 'https',
      //   hostname: 'your-account.r2.cloudflarestorage.com',
      //   pathname: '/**',
      // },
    ],
  },
  webpack: (config, { isServer, webpack }) => {
    // Exclude Prisma from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        'pg': false,
        'pg-native': false,
      }
      
      // Ignore Prisma and related packages in client bundle
      config.externals = config.externals || []
      config.externals.push({
        '@prisma/client': 'commonjs @prisma/client',
        'prisma': 'commonjs prisma',
        '.prisma/client': 'commonjs .prisma/client',
      })
      
      // Ignore Prisma files using webpack.IgnorePlugin
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^@prisma\/client$/,
          contextRegExp: /node_modules/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.prisma\/client$/,
          contextRegExp: /node_modules/,
        })
      )
    }
    
    return config
  },
}

module.exports = nextConfig

