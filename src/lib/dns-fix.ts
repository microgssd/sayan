import dns from 'node:dns';

/**
 * Some ISP/router DNS servers (common on Windows) refuse the SRV lookups that
 * mongodb+srv:// URIs need, causing "querySrv ECONNREFUSED". Setting
 * DNS_SERVERS (e.g. "8.8.8.8,1.1.1.1") makes Node use public resolvers instead.
 */
const servers = process.env.DNS_SERVERS?.split(',').map((s) => s.trim()).filter(Boolean);
if (servers?.length) {
  dns.setServers(servers);
  dns.promises.setServers(servers);
}
