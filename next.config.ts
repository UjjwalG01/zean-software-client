/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/:path*',
                has: [
                    {
                        type: 'host',
                        value: '(.*)', // match all hosts
                    },
                ],
                destination: '/index.html', // fallback to SPA entry
            },
        ];
    },
};

module.exports = nextConfig;