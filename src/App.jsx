import { useEffect, useRef, useState } from 'react';

const DEVICE_TYPES = {
  host: { label: 'Host', icon: 'PC', color: '#48d597', defaultPorts: 1 },
  switch: { label: 'Switch', icon: 'SW', color: '#5aa7ff', defaultPorts: 6 },
  router: { label: 'Router', icon: 'RT', color: '#f7b955', defaultPorts: 2 },
};

const AWS_INITIAL = {
  vpcs: [
    { id: 'vpc-main', name: 'Production VPC', cidr: '10.20.0.0/16', x: 70, y: 60, width: 920, height: 470 },
  ],
  subnets: [
    { id: 'subnet-public', vpcId: 'vpc-main', name: 'Public subnet', cidr: '10.20.1.0/24', az: 'eu-west-1a', routeTableId: 'rt-public', naclId: 'nacl-default', x: 110, y: 135, width: 250, height: 290 },
    { id: 'subnet-private', vpcId: 'vpc-main', name: 'Private app subnet', cidr: '10.20.2.0/24', az: 'eu-west-1a', routeTableId: 'rt-private', naclId: 'nacl-default', x: 415, y: 135, width: 250, height: 290 },
    { id: 'subnet-data', vpcId: 'vpc-main', name: 'Data subnet', cidr: '10.20.3.0/24', az: 'eu-west-1a', routeTableId: 'rt-data', naclId: 'nacl-default', x: 720, y: 135, width: 230, height: 290 },
  ],
  gateways: [
    { id: 'igw-main', type: 'igw', name: 'Internet Gateway', vpcId: 'vpc-main', x: 145, y: 75 },
    { id: 'nat-public', type: 'nat', name: 'NAT Gateway', subnetId: 'subnet-public', privateIp: '10.20.1.5', publicIp: '54.12.0.10', x: 205, y: 335 },
  ],
  routeTables: [
    { id: 'rt-public', name: 'Public RT', routes: [{ destination: '10.20.0.0/16', target: 'local' }, { destination: '0.0.0.0/0', target: 'igw-main' }] },
    { id: 'rt-private', name: 'Private RT', routes: [{ destination: '10.20.0.0/16', target: 'local' }, { destination: '0.0.0.0/0', target: 'nat-public' }] },
    { id: 'rt-data', name: 'Data RT', routes: [{ destination: '10.20.0.0/16', target: 'local' }] },
  ],
  nacls: [
    { id: 'nacl-default', name: 'Default NACL', inbound: 'allow', outbound: 'allow' },
  ],
  securityGroups: [
    { id: 'sg-alb', name: 'alb-sg', inbound: [{ protocol: 'HTTP', source: '0.0.0.0/0' }], outbound: [{ protocol: 'ALL', destination: '0.0.0.0/0' }] },
    { id: 'sg-bastion', name: 'bastion-sg', inbound: [{ protocol: 'ICMP', source: '0.0.0.0/0' }], outbound: [{ protocol: 'ALL', destination: '0.0.0.0/0' }] },
    { id: 'sg-app', name: 'app-sg', inbound: [{ protocol: 'HTTP', source: 'sg:sg-alb' }, { protocol: 'ICMP', source: '10.20.0.0/16' }], outbound: [{ protocol: 'ALL', destination: '0.0.0.0/0' }] },
    { id: 'sg-db', name: 'db-sg', inbound: [{ protocol: 'MYSQL', source: 'sg:sg-app' }], outbound: [{ protocol: 'ALL', destination: '10.20.0.0/16' }] },
  ],
  instances: [
    { id: 'ec2-bastion', name: 'Bastion EC2', subnetId: 'subnet-public', privateIp: '10.20.1.20', publicIp: '54.12.0.20', securityGroupIds: ['sg-bastion'], x: 190, y: 205 },
    { id: 'ec2-app', name: 'App EC2', subnetId: 'subnet-private', privateIp: '10.20.2.10', publicIp: '', securityGroupIds: ['sg-app'], x: 500, y: 240 },
    { id: 'ec2-db', name: 'Database EC2', subnetId: 'subnet-data', privateIp: '10.20.3.10', publicIp: '', securityGroupIds: ['sg-db'], x: 800, y: 240 },
  ],
  loadBalancers: [
    { id: 'alb-public', name: 'Public ALB', type: 'alb', scheme: 'internet-facing', subnetIds: ['subnet-public'], privateIp: '10.20.1.10', dnsName: 'app.example.aws', securityGroupIds: ['sg-alb'], targetIds: ['ec2-app'], x: 210, y: 135 },
  ],
};

const INITIAL_DEVICES = [
  {
    id: 'pc-a',
    type: 'host',
    name: 'Workstation A',
    x: 110,
    y: 130,
    gateway: '192.168.10.1',
    interfaces: [iface('pc-a', 0, 'eth0', '192.168.10.10', '255.255.255.0')],
    arp: {},
    routes: [],
  },
  {
    id: 'pc-c',
    type: 'host',
    name: 'Workstation C',
    x: 110,
    y: 250,
    gateway: '192.168.10.1',
    interfaces: [iface('pc-c', 0, 'eth0', '192.168.10.11', '255.255.255.0')],
    arp: {},
    routes: [],
  },
  {
    id: 'pc-d',
    type: 'host',
    name: 'Workstation D',
    x: 110,
    y: 370,
    gateway: '192.168.10.1',
    interfaces: [iface('pc-d', 0, 'eth0', '192.168.10.12', '255.255.255.0')],
    arp: {},
    routes: [],
  },
  {
    id: 'sw-1',
    type: 'switch',
    name: 'Access Switch',
    x: 390,
    y: 250,
    gateway: '',
    interfaces: Array.from({ length: 6 }, (_, index) => iface('sw-1', index, `fa0/${index + 1}`)),
    arp: {},
    routes: [],
  },
  {
    id: 'r-1',
    type: 'router',
    name: 'Edge Router',
    x: 670,
    y: 170,
    gateway: '',
    interfaces: [
      { ...iface('r-1', 0, 'g0/0', '192.168.10.1', '255.255.255.0'), natRole: 'inside' },
      { ...iface('r-1', 1, 'g0/1', '10.0.0.1', '255.255.255.0'), natRole: 'outside' },
    ],
    arp: {},
    routes: [],
    natTranslations: [],
  },
  {
    id: 'pc-b',
    type: 'host',
    name: 'Server B',
    x: 950,
    y: 130,
    gateway: '10.0.0.1',
    interfaces: [iface('pc-b', 0, 'eth0', '10.0.0.20', '255.255.255.0')],
    arp: {},
    routes: [],
  },
];

const INITIAL_LINKS = [
  link('pc-a', 'pc-a-if-0', 'sw-1', 'sw-1-if-0'),
  link('pc-c', 'pc-c-if-0', 'sw-1', 'sw-1-if-1'),
  link('pc-d', 'pc-d-if-0', 'sw-1', 'sw-1-if-2'),
  link('sw-1', 'sw-1-if-3', 'r-1', 'r-1-if-0'),
  link('r-1', 'r-1-if-1', 'pc-b', 'pc-b-if-0'),
];

function iface(deviceId, index, name, ip = '', mask = '') {
  return {
    id: `${deviceId}-if-${index}`,
    name,
    mac: deterministicMac(`${deviceId}-${index}`),
    ip,
    mask,
  };
}

function link(aDeviceId, aInterfaceId, bDeviceId, bInterfaceId) {
  return {
    id: `${aDeviceId}:${aInterfaceId}|${bDeviceId}:${bInterfaceId}`,
    a: { deviceId: aDeviceId, interfaceId: aInterfaceId },
    b: { deviceId: bDeviceId, interfaceId: bInterfaceId },
  };
}

function deterministicMac(seed) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const octets = [0x02, 0x42, (hash >> 24) & 255, (hash >> 16) & 255, (hash >> 8) & 255, hash & 255];
  return octets.map((octet) => octet.toString(16).padStart(2, '0')).join(':');
}

function parseIPv4(value) {
  const parts = value.trim().split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const number = Number(part);
    if (number < 0 || number > 255) return null;
    result = ((result << 8) | number) >>> 0;
  }
  return result >>> 0;
}

function parseMask(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('/')) {
    const bits = Number(trimmed.slice(1));
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
    return bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  }
  return parseIPv4(trimmed);
}

function ipToString(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function sameSubnet(ipA, maskA, ipB) {
  const parsedA = parseIPv4(ipA);
  const parsedMask = parseMask(maskA);
  const parsedB = parseIPv4(ipB);
  if (parsedA === null || parsedMask === null || parsedB === null) return false;
  return (parsedA & parsedMask) === (parsedB & parsedMask);
}

function networkOf(ip, mask) {
  const parsedIp = parseIPv4(ip);
  const parsedMask = parseMask(mask);
  if (parsedIp === null || parsedMask === null) return null;
  return ipToString((parsedIp & parsedMask) >>> 0);
}

function routeMatches(route, targetIp) {
  const network = parseIPv4(route.network);
  const mask = parseMask(route.mask);
  const target = parseIPv4(targetIp);
  if (network === null || mask === null || target === null) return false;
  return (network & mask) === (target & mask);
}

function maskBits(mask) {
  const parsed = parseMask(mask);
  if (parsed === null) return -1;
  return parsed.toString(2).split('1').length - 1;
}

function endpointKey(endpoint) {
  return `${endpoint.deviceId}:${endpoint.interfaceId}`;
}

function getDevice(devices, id) {
  return devices.find((device) => device.id === id);
}

function getInterface(devices, deviceId, interfaceId) {
  return getDevice(devices, deviceId)?.interfaces.find((item) => item.id === interfaceId);
}

function getInterfaceOwner(devices, interfaceId) {
  for (const device of devices) {
    const nic = device.interfaces.find((item) => item.id === interfaceId);
    if (nic) return { device, nic };
  }
  return null;
}

function occupiedInterfaces(links) {
  const occupied = new Set();
  links.forEach((item) => {
    occupied.add(endpointKey(item.a));
    occupied.add(endpointKey(item.b));
  });
  return occupied;
}

function l2ReachableInterfaces(devices, links, startEndpoint) {
  const byEndpoint = new Map();
  const switchPorts = new Map();
  links.forEach((item) => {
    const aKey = endpointKey(item.a);
    const bKey = endpointKey(item.b);
    byEndpoint.set(aKey, [...(byEndpoint.get(aKey) || []), item.b]);
    byEndpoint.set(bKey, [...(byEndpoint.get(bKey) || []), item.a]);
  });
  devices.forEach((device) => {
    if (device.type === 'switch') {
      switchPorts.set(device.id, device.interfaces.map((nic) => ({ deviceId: device.id, interfaceId: nic.id })));
    }
  });

  const queue = [startEndpoint];
  const visited = new Set();
  const reachable = [];
  while (queue.length > 0) {
    const current = queue.shift();
    const key = endpointKey(current);
    if (visited.has(key)) continue;
    visited.add(key);

    const owner = getDevice(devices, current.deviceId);
    if (owner && owner.type !== 'switch' && key !== endpointKey(startEndpoint)) {
      const nic = getInterface(devices, current.deviceId, current.interfaceId);
      reachable.push({ device: owner, nic, endpoint: current });
    }

    for (const neighbor of byEndpoint.get(key) || []) {
      queue.push(neighbor);
    }
    if (owner?.type === 'switch') {
      for (const port of switchPorts.get(owner.id) || []) {
        if (endpointKey(port) !== key) queue.push(port);
      }
    }
  }
  return reachable;
}

function findIpOnSegment(devices, links, sourceEndpoint, ip) {
  return l2ReachableInterfaces(devices, links, sourceEndpoint).find(({ nic }) => nic?.ip === ip);
}

function findIpPathOnSegment(devices, links, sourceEndpoint, ip) {
  const byEndpoint = new Map();
  const switchPorts = new Map();
  links.forEach((item) => {
    const aKey = endpointKey(item.a);
    const bKey = endpointKey(item.b);
    byEndpoint.set(aKey, [...(byEndpoint.get(aKey) || []), { endpoint: item.b, linkId: item.id }]);
    byEndpoint.set(bKey, [...(byEndpoint.get(bKey) || []), { endpoint: item.a, linkId: item.id }]);
  });
  devices.forEach((device) => {
    if (device.type === 'switch') {
      switchPorts.set(device.id, device.interfaces.map((nic) => ({ deviceId: device.id, interfaceId: nic.id })));
    }
  });

  const queue = [{ endpoint: sourceEndpoint, linkIds: [], deviceIds: [sourceEndpoint.deviceId] }];
  const visited = new Set();
  const startKey = endpointKey(sourceEndpoint);
  while (queue.length > 0) {
    const current = queue.shift();
    const key = endpointKey(current.endpoint);
    if (visited.has(key)) continue;
    visited.add(key);

    const owner = getDevice(devices, current.endpoint.deviceId);
    const nic = getInterface(devices, current.endpoint.deviceId, current.endpoint.interfaceId);
    if (owner && owner.type !== 'switch' && key !== startKey && nic?.ip === ip) {
      return { device: owner, nic, endpoint: current.endpoint, linkIds: current.linkIds, deviceIds: current.deviceIds };
    }

    for (const neighbor of byEndpoint.get(key) || []) {
      queue.push({
        endpoint: neighbor.endpoint,
        linkIds: [...current.linkIds, neighbor.linkId],
        deviceIds: [...new Set([...current.deviceIds, neighbor.endpoint.deviceId])],
      });
    }
    if (owner?.type === 'switch') {
      for (const port of switchPorts.get(owner.id) || []) {
        if (endpointKey(port) !== key) {
          queue.push({ endpoint: port, linkIds: current.linkIds, deviceIds: current.deviceIds });
        }
      }
    }
  }
  return null;
}

function chooseSourceInterface(device, destinationIp) {
  return (
    device.interfaces.find((nic) => nic.ip && nic.mask && sameSubnet(nic.ip, nic.mask, destinationIp)) ||
    device.interfaces.find((nic) => nic.ip && nic.mask)
  );
}

function firstConfiguredIp(device) {
  return device?.interfaces.find((nic) => nic.ip)?.ip || '';
}

function natTranslationId(insideIp, outsideIp, destinationIp) {
  return `${insideIp}->${outsideIp}:${destinationIp}:icmp`;
}

function ipPrefixParts(ip, mask) {
  const bits = maskBits(mask);
  if (!ip || bits < 0) return null;
  const octets = ip.split('.');
  if (octets.length !== 4) return null;
  return {
    bits,
    fullOctets: Math.floor(bits / 8),
    hasPartialOctet: bits % 8 !== 0,
    octets,
  };
}

function cloneAwsTopology() {
  return JSON.parse(JSON.stringify(AWS_INITIAL));
}

function cidrToIpMask(cidr) {
  const [ip, bits = '32'] = cidr.split('/');
  return { ip, mask: `/${bits}`, bits: Number(bits) };
}

function ipInCidr(ip, cidr) {
  const parsedIp = parseIPv4(ip);
  const { ip: networkIp, mask } = cidrToIpMask(cidr);
  const parsedNetwork = parseIPv4(networkIp);
  const parsedMask = parseMask(mask);
  if (parsedIp === null || parsedNetwork === null || parsedMask === null) return false;
  return (parsedIp & parsedMask) === (parsedNetwork & parsedMask);
}

function awsResourceId(resource) {
  return resource?.id || '';
}

function findAwsResource(aws, id) {
  if (id === 'internet') return { id: 'internet', type: 'internet', name: 'Internet', x: 25, y: 40 };
  return (
    aws.instances.find((item) => item.id === id) ||
    aws.loadBalancers.find((item) => item.id === id) ||
    aws.gateways.find((item) => item.id === id) ||
    aws.subnets.find((item) => item.id === id) ||
    aws.vpcs.find((item) => item.id === id)
  );
}

function awsSubnetOf(aws, resource) {
  if (!resource) return null;
  if (resource.subnetId) return aws.subnets.find((item) => item.id === resource.subnetId);
  if (resource.subnetIds?.length) return aws.subnets.find((item) => item.id === resource.subnetIds[0]);
  return null;
}

function awsVpcOf(aws, resource) {
  const subnet = awsSubnetOf(aws, resource);
  if (subnet) return aws.vpcs.find((item) => item.id === subnet.vpcId);
  if (resource?.vpcId) return aws.vpcs.find((item) => item.id === resource.vpcId);
  return aws.vpcs[0];
}

function awsRouteTableForSubnet(aws, subnetId) {
  const subnet = aws.subnets.find((item) => item.id === subnetId);
  return aws.routeTables.find((item) => item.id === subnet?.routeTableId);
}

function awsBestRoute(routeTable, destinationIp) {
  if (!routeTable) return null;
  return [...routeTable.routes]
    .filter((route) => (route.destination === 'local' ? ipInCidr(destinationIp, AWS_INITIAL.vpcs[0].cidr) : ipInCidr(destinationIp, route.destination)))
    .sort((a, b) => cidrToIpMask(b.destination === 'local' ? AWS_INITIAL.vpcs[0].cidr : b.destination).bits - cidrToIpMask(a.destination === 'local' ? AWS_INITIAL.vpcs[0].cidr : a.destination).bits)[0];
}

function awsProtocolPort(protocol) {
  if (protocol === 'HTTP') return 80;
  if (protocol === 'MYSQL') return 3306;
  return 0;
}

function awsRuleMatches(rule, protocol, peer) {
  if (rule.protocol !== 'ALL' && rule.protocol !== protocol) return false;
  const value = rule.source || rule.destination || '';
  if (value === '0.0.0.0/0') return true;
  if (value.startsWith('sg:')) return peer.securityGroupIds?.includes(value.slice(3));
  if (peer.ip && ipInCidr(peer.ip, value)) return true;
  return false;
}

function awsSecurityGroupAllows(aws, securityGroupIds, direction, protocol, peer) {
  const groups = securityGroupIds.map((id) => aws.securityGroups.find((group) => group.id === id)).filter(Boolean);
  return groups.some((group) => (group[direction] || []).some((rule) => awsRuleMatches(rule, protocol, peer)));
}

function awsNaclAllows(aws, subnetId) {
  const subnet = aws.subnets.find((item) => item.id === subnetId);
  const nacl = aws.nacls.find((item) => item.id === subnet?.naclId);
  return !nacl || (nacl.inbound === 'allow' && nacl.outbound === 'allow');
}

function simulateAwsTraffic(aws, sourceId, targetId, protocol) {
  const trace = [];
  const visual = { resources: {}, subnets: {}, vpcs: {}, routes: {} };
  const mark = (kind, ids, status = 'success') => ids.filter(Boolean).forEach((id) => {
    visual[kind][id] = status;
  });
  const markResource = (ids, status = 'success') => mark('resources', ids, status);
  const markSubnet = (ids, status = 'success') => mark('subnets', ids, status);
  const markVpc = (ids, status = 'success') => mark('vpcs', ids, status);
  const markRoute = (ids, status = 'success') => mark('routes', ids, status);

  const source = findAwsResource(aws, sourceId);
  const target = findAwsResource(aws, targetId);
  if (!source || !target) return { ok: false, trace: ['Source or target does not exist.'], visual };
  if (source.id === target.id) return { ok: false, trace: ['Choose different source and target resources.'], visual };

  const targetIp = target.privateIp || target.publicIp;
  const sourceIp = source.privateIp || source.publicIp || '0.0.0.0';
  const targetSubnet = awsSubnetOf(aws, target);
  const sourceSubnet = awsSubnetOf(aws, source);
  const vpc = awsVpcOf(aws, target) || awsVpcOf(aws, source);
  markVpc([vpc?.id]);

  trace.push(`${source.name} sends ${protocol}${awsProtocolPort(protocol) ? `:${awsProtocolPort(protocol)}` : ''} traffic to ${target.name}.`);

  const fail = (message, ids = []) => {
    trace.push(message);
    markResource(ids, 'error');
    return { ok: false, trace, visual };
  };

  const checkTargetSecurity = (targetResource, peer, why = 'inbound') => {
    if (!targetResource.securityGroupIds?.length) return true;
    const allowed = awsSecurityGroupAllows(aws, targetResource.securityGroupIds, 'inbound', protocol, peer);
    trace.push(`${targetResource.name} security group ${allowed ? 'allows' : 'blocks'} ${why} ${protocol} from ${peer.name || peer.ip}.`);
    return allowed;
  };

  if (source.id === 'internet') {
    markResource(['internet']);
    if (target.type === 'alb') {
      markResource([target.id, 'igw-main']);
      markSubnet(target.subnetIds || []);
      if (target.scheme !== 'internet-facing') return fail(`${target.name} is internal and cannot receive Internet traffic.`, [target.id]);
      if (!awsNaclAllows(aws, target.subnetIds[0])) return fail(`${target.name} subnet NACL blocks the request.`, [target.id]);
      if (!checkTargetSecurity(target, { name: 'Internet', ip: '8.8.8.8', securityGroupIds: [] }, 'Internet')) return fail(`${target.name} security group rejected the request.`, [target.id]);
      const targetInstance = aws.instances.find((item) => target.targetIds.includes(item.id));
      if (!targetInstance) return fail(`${target.name} has no registered targets.`, [target.id]);
      markResource([targetInstance.id]);
      markSubnet([targetInstance.subnetId]);
      if (!checkTargetSecurity(targetInstance, { name: target.name, ip: target.privateIp, securityGroupIds: target.securityGroupIds }, 'ALB target')) return fail(`${targetInstance.name} security group rejected traffic from ${target.name}.`, [targetInstance.id]);
      trace.push(`${target.name} forwards to target ${targetInstance.name}; response returns through the ALB and Internet Gateway.`);
      return { ok: true, trace, visual };
    }

    if (target.type !== 'internet' && !target.publicIp) return fail(`${target.name} has no public address or public load balancer entry point.`, [target.id]);
    markResource([target.id, 'igw-main']);
    markSubnet([targetSubnet?.id]);
    if (!checkTargetSecurity(target, { name: 'Internet', ip: '8.8.8.8', securityGroupIds: [] }, 'Internet')) return fail(`${target.name} security group rejected Internet traffic.`, [target.id]);
    trace.push(`Internet Gateway delivers traffic to ${target.name}.`);
    return { ok: true, trace, visual };
  }

  if (source.type === 'internet') return fail('Internet cannot be used as an internal AWS source here.', ['internet']);
  markResource([source.id]);
  markSubnet([sourceSubnet?.id]);
  if (!awsNaclAllows(aws, sourceSubnet?.id)) return fail(`${sourceSubnet?.name || 'Source subnet'} NACL blocks outbound or inbound return traffic.`, [source.id]);
  if (source.securityGroupIds?.length && !awsSecurityGroupAllows(aws, source.securityGroupIds, 'outbound', protocol, { name: target.name, ip: targetIp, securityGroupIds: target.securityGroupIds || [] })) {
    return fail(`${source.name} security group blocks outbound ${protocol}.`, [source.id]);
  }

  if (target.id === 'internet') {
    const routeTable = awsRouteTableForSubnet(aws, sourceSubnet?.id);
    const route = awsBestRoute(routeTable, '1.1.1.1');
    markRoute([routeTable?.id]);
    if (!route || route.target === 'local') return fail(`${sourceSubnet?.name} has no default route to the Internet.`, [source.id]);
    trace.push(`${routeTable.name} sends 0.0.0.0/0 traffic to ${route.target}.`);
    if (route.target.startsWith('nat')) {
      const nat = aws.gateways.find((item) => item.id === route.target);
      const natSubnet = aws.subnets.find((item) => item.id === nat?.subnetId);
      markResource([nat?.id, 'igw-main', 'internet']);
      markSubnet([natSubnet?.id]);
      trace.push(`${nat.name} translates ${source.privateIp} to public IP ${nat.publicIp}.`);
      trace.push(`${natSubnet.name} route table reaches the Internet Gateway.`);
      return { ok: true, trace, visual };
    }
    if (route.target.startsWith('igw')) {
      if (!source.publicIp) return fail(`${source.name} uses an Internet Gateway route but has no public IP.`, [source.id, route.target]);
      markResource([route.target, 'internet']);
      trace.push(`Internet Gateway forwards traffic using ${source.name}'s public IP ${source.publicIp}.`);
      return { ok: true, trace, visual };
    }
    return fail(`Unsupported route target ${route.target}.`, [source.id]);
  }

  if (target.type === 'alb') {
    markResource([target.id]);
    markSubnet(target.subnetIds || []);
    if (!checkTargetSecurity(target, { name: source.name, ip: sourceIp, securityGroupIds: source.securityGroupIds || [] }, 'client')) return fail(`${target.name} security group rejected ${source.name}.`, [target.id]);
    const targetInstance = aws.instances.find((item) => target.targetIds.includes(item.id));
    if (!targetInstance) return fail(`${target.name} has no registered targets.`, [target.id]);
    if (!checkTargetSecurity(targetInstance, { name: target.name, ip: target.privateIp, securityGroupIds: target.securityGroupIds }, 'ALB target')) return fail(`${targetInstance.name} security group rejected ${target.name}.`, [targetInstance.id]);
    markResource([targetInstance.id]);
    markSubnet([targetInstance.subnetId]);
    trace.push(`${target.name} accepts the request and forwards it to ${targetInstance.name}.`);
    return { ok: true, trace, visual };
  }

  if (targetSubnet && sourceSubnet && awsVpcOf(aws, source)?.id === awsVpcOf(aws, target)?.id) {
    const routeTable = awsRouteTableForSubnet(aws, sourceSubnet.id);
    const route = awsBestRoute(routeTable, target.privateIp);
    markRoute([routeTable?.id]);
    if (!route || route.target !== 'local') return fail(`${sourceSubnet.name} does not route ${target.privateIp} locally.`, [source.id]);
    trace.push(`${routeTable.name} uses the VPC local route for ${target.privateIp}.`);
    markResource([target.id]);
    markSubnet([targetSubnet.id]);
    if (!awsNaclAllows(aws, targetSubnet.id)) return fail(`${targetSubnet.name} NACL blocks the traffic.`, [target.id]);
    if (!checkTargetSecurity(target, { name: source.name, ip: sourceIp, securityGroupIds: source.securityGroupIds || [] }, 'VPC')) return fail(`${target.name} security group rejected ${source.name}.`, [target.id]);
    trace.push(`${target.name} receives the traffic over the VPC local route.`);
    return { ok: true, trace, visual };
  }

  return fail('No supported AWS path was found for this request.', [source.id, target.id]);
}

function simulatePing(devices, links, sourceDeviceId, destinationIp) {
  const trace = [];
  const visual = { nodes: {}, links: {} };
  const markOk = (deviceIds = [], linkIds = []) => {
    deviceIds.forEach((id) => {
      if (visual.nodes[id] !== 'error') visual.nodes[id] = 'success';
    });
    linkIds.forEach((id) => {
      if (visual.links[id] !== 'error') visual.links[id] = 'success';
    });
  };
  const markError = (deviceIds = [], linkIds = []) => {
    deviceIds.forEach((id) => {
      visual.nodes[id] = 'error';
    });
    linkIds.forEach((id) => {
      visual.links[id] = 'error';
    });
  };
  const source = getDevice(devices, sourceDeviceId);
  if (!source) return { ok: false, trace: ['Source device does not exist.'], updates: [], visual };
  if (parseIPv4(destinationIp) === null) return { ok: false, trace: ['Destination IP address is invalid.'], updates: [], visual };

  const sourceNic = chooseSourceInterface(source, destinationIp);
  if (!sourceNic) {
    markError([source.id]);
    return { ok: false, trace: [`${source.name} has no configured IP interface.`], updates: [], visual };
  }

  const updates = [];
  const visitedRouters = new Set();

  const applyNatIfNeeded = (router, incomingInterfaceId, outgoingNic, packet) => {
    const incomingNic = router.interfaces.find((nic) => nic.id === incomingInterfaceId);
    if (incomingNic?.natRole !== 'inside' || outgoingNic?.natRole !== 'outside' || !outgoingNic.ip) return packet;
    if (packet.sourceIp === outgoingNic.ip) return packet;

    const translation = {
      id: natTranslationId(packet.sourceIp, outgoingNic.ip, packet.destinationIp),
      insideIp: packet.sourceIp,
      outsideIp: outgoingNic.ip,
      destinationIp: packet.destinationIp,
      protocol: 'ICMP',
    };
    trace.push(`${router.name} applies source NAT: ${packet.sourceIp} -> ${outgoingNic.ip} (${incomingNic.name} inside to ${outgoingNic.name} outside).`);
    updates.push({ kind: 'nat', deviceId: router.id, translation });
    return { ...packet, sourceIp: outgoingNic.ip, nat: { routerName: router.name, ...translation } };
  };

  const arpResolve = (device, nic, targetIp) => {
    const endpoint = { deviceId: device.id, interfaceId: nic.id };
    const existing = device.arp[targetIp];
    if (existing) {
      trace.push(`${device.name} uses cached ARP ${targetIp} -> ${existing}.`);
    } else {
      trace.push(`${device.name} broadcasts ARP on ${nic.name}: who has ${targetIp}?`);
    }
    const target = findIpPathOnSegment(devices, links, endpoint, targetIp);
    if (!target) {
      trace.push(`No interface with ${targetIp} answered on that Ethernet segment.`);
      markError([device.id]);
      return null;
    }
    trace.push(`${target.device.name} replies with MAC ${target.nic.mac}.`);
    updates.push({ deviceId: device.id, ip: targetIp, mac: target.nic.mac });
    markOk(target.deviceIds, target.linkIds);
    return target;
  };

  const deliverFromRouter = (router, destination, incomingInterfaceId, packet) => {
    if (visitedRouters.has(router.id)) {
      trace.push(`Routing loop detected at ${router.name}.`);
      markError([router.id]);
      return false;
    }
    visitedRouters.add(router.id);
    markOk([router.id]);

    const directNic = router.interfaces.find((nic) => nic.ip && nic.mask && sameSubnet(nic.ip, nic.mask, destination));
    if (directNic) {
      trace.push(`${router.name} has connected route ${networkOf(directNic.ip, directNic.mask)}/${maskBits(directNic.mask)} via ${directNic.name}.`);
      const forwardedPacket = applyNatIfNeeded(router, incomingInterfaceId, directNic, packet);
      const finalTarget = arpResolve(router, directNic, destination);
      if (!finalTarget) return false;
      trace.push(`ICMP echo reaches ${finalTarget.device.name} from ${forwardedPacket.sourceIp}; echo reply follows the reverse path.`);
      if (forwardedPacket.nat) {
        trace.push(`${forwardedPacket.nat.routerName} maps the reply for ${forwardedPacket.nat.outsideIp} back to ${forwardedPacket.nat.insideIp}.`);
      }
      updates.push({ deviceId: finalTarget.device.id, ip: directNic.ip, mac: directNic.mac });
      markOk([finalTarget.device.id]);
      return true;
    }

    const route = [...router.routes].filter((item) => routeMatches(item, destination)).sort((a, b) => maskBits(b.mask) - maskBits(a.mask))[0];
    if (!route) {
      trace.push(`${router.name} has no route to ${destination}.`);
      markError([router.id]);
      return false;
    }
    const outgoingNic = router.interfaces.find((nic) => nic.id === route.interfaceId) || router.interfaces.find((nic) => nic.ip && nic.mask && sameSubnet(nic.ip, nic.mask, route.nextHop));
    if (!outgoingNic) {
      trace.push(`${router.name} cannot choose an outgoing interface for route ${route.network}/${route.mask}.`);
      markError([router.id]);
      return false;
    }
    trace.push(`${router.name} forwards by static route ${route.network}/${route.mask} toward ${route.nextHop}.`);
    const forwardedPacket = applyNatIfNeeded(router, incomingInterfaceId, outgoingNic, packet);
    const nextHop = arpResolve(router, outgoingNic, route.nextHop);
    if (!nextHop) return false;
    if (nextHop.device.type !== 'router') {
      trace.push(`${nextHop.device.name} is not a router, so the packet stops.`);
      markError([nextHop.device.id]);
      return false;
    }
    return deliverFromRouter(nextHop.device, destination, nextHop.nic.id, forwardedPacket);
  };

  const nextHopIp = sameSubnet(sourceNic.ip, sourceNic.mask, destinationIp) ? destinationIp : source.gateway;
  if (!nextHopIp) {
    return {
      ok: false,
      trace: [`${source.name} needs a default gateway to reach ${destinationIp}.`],
      updates: [],
      visual: { nodes: { [source.id]: 'error' }, links: {} },
    };
  }

  markOk([source.id]);
  trace.push(`${source.name} sends ICMP echo from ${sourceNic.ip} to ${destinationIp}.`);
  const firstHop = arpResolve(source, sourceNic, nextHopIp);
  if (!firstHop) return { ok: false, trace, updates, visual };

  if (firstHop.nic.ip === destinationIp) {
    trace.push(`ICMP echo reaches ${firstHop.device.name}; echo reply is delivered on the same Ethernet segment.`);
    updates.push({ deviceId: firstHop.device.id, ip: sourceNic.ip, mac: sourceNic.mac });
    markOk([firstHop.device.id]);
    return { ok: true, trace, updates, visual };
  }

  if (firstHop.device.type !== 'router') {
    trace.push(`${firstHop.device.name} is not a router for off-subnet traffic.`);
    markError([firstHop.device.id]);
    return { ok: false, trace, updates, visual };
  }

  const ok = deliverFromRouter(firstHop.device, destinationIp, firstHop.nic.id, { sourceIp: sourceNic.ip, destinationIp });
  return { ok, trace, updates, visual };
}

function applyArpUpdates(devices, updates) {
  if (!updates.length) return devices;
  return devices.map((device) => {
    const entries = updates.filter((item) => item.deviceId === device.id && item.kind !== 'nat');
    const natEntries = updates.filter((item) => item.deviceId === device.id && item.kind === 'nat');
    if (!entries.length && !natEntries.length) return device;
    const nextArp = { ...device.arp };
    entries.forEach((item) => {
      nextArp[item.ip] = item.mac;
    });
    const nextNatTranslations = [...(device.natTranslations || [])];
    natEntries.forEach((item) => {
      if (!nextNatTranslations.some((translation) => translation.id === item.translation.id)) {
        nextNatTranslations.push(item.translation);
      }
    });
    return { ...device, arp: nextArp, natTranslations: nextNatTranslations };
  });
}

function validateTopologyPayload(payload) {
  const topology = payload?.devices && payload?.links ? payload : payload?.topology;
  if (!topology || !Array.isArray(topology.devices) || !Array.isArray(topology.links)) {
    throw new Error('Clipboard JSON must contain devices and links arrays.');
  }

  const deviceIds = new Set();
  const interfaceIds = new Set();
  for (const device of topology.devices) {
    if (!device?.id || !DEVICE_TYPES[device.type] || !Array.isArray(device.interfaces)) {
      throw new Error('At least one device is missing id, type, or interfaces.');
    }
    if (deviceIds.has(device.id)) throw new Error(`Duplicate device id: ${device.id}`);
    deviceIds.add(device.id);
    for (const nic of device.interfaces) {
      if (!nic?.id) throw new Error(`${device.name || device.id} has an interface without an id.`);
      interfaceIds.add(`${device.id}:${nic.id}`);
    }
  }

  for (const item of topology.links) {
    if (!item?.id || !item.a || !item.b) throw new Error('At least one link is malformed.');
    if (!interfaceIds.has(endpointKey(item.a)) || !interfaceIds.has(endpointKey(item.b))) {
      throw new Error(`Link ${item.id} references a missing interface.`);
    }
  }

  return {
    devices: topology.devices.map((device) => ({
      ...device,
      name: device.name || device.id,
      x: Number.isFinite(device.x) ? device.x : 80,
      y: Number.isFinite(device.y) ? device.y : 80,
      gateway: device.gateway || '',
      arp: device.arp || {},
      routes: Array.isArray(device.routes) ? device.routes : [],
      natTranslations: Array.isArray(device.natTranslations) ? device.natTranslations : [],
    })),
    links: topology.links,
    awsTopology: topology.awsTopology,
  };
}

function App() {
  const [labMode, setLabMode] = useState('ethernet');
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  const [links, setLinks] = useState(INITIAL_LINKS);
  const [selectedId, setSelectedId] = useState(INITIAL_DEVICES[0].id);
  const [newType, setNewType] = useState('host');
  const [linkDraft, setLinkDraft] = useState({ fromDevice: '', fromInterface: '', toDevice: '', toInterface: '' });
  const [pingDraft, setPingDraft] = useState({ source: INITIAL_DEVICES[0].id, destination: '10.0.0.20' });
  const [log, setLog] = useState([
    { id: 'welcome', ok: true, title: 'Welcome', lines: ['Try pinging 10.0.0.20 from Workstation A, then inspect ARP tables.'] },
  ]);
  const [showEndpointLabels, setShowEndpointLabels] = useState(false);
  const [topologyZoom, setTopologyZoom] = useState(0.9);
  const [pingVisual, setPingVisual] = useState({ nodes: {}, links: {} });
  const [dragging, setDragging] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [awsTopology, setAwsTopology] = useState(() => cloneAwsTopology());
  const boardRef = useRef(null);

  const selected = devices.find((device) => device.id === selectedId) || devices[0];
  const occupied = occupiedInterfaces(links);

  const selectDevice = (deviceId) => {
    const device = getDevice(devices, deviceId);
    setSelectedId(deviceId);
    if (device?.type !== 'switch') {
      setPingDraft((current) => ({ ...current, source: deviceId }));
    }
  };

  useEffect(() => {
    if (!selected && devices[0]) setSelectedId(devices[0].id);
  }, [devices, selected]);

  useEffect(() => {
    const closeContextMenu = () => setContextMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('resize', closeContextMenu);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('resize', closeContextMenu);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const onMove = (event) => {
      if (!dragging || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const logicalWidth = rect.width / topologyZoom;
      const logicalHeight = rect.height / topologyZoom;
      const x = Math.max(20, Math.min(logicalWidth - 120, (event.clientX - rect.left) / topologyZoom - dragging.offsetX));
      const y = Math.max(20, Math.min(logicalHeight - 90, (event.clientY - rect.top) / topologyZoom - dragging.offsetY));
      setDevices((items) => items.map((item) => (item.id === dragging.id ? { ...item, x, y } : item)));
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, topologyZoom]);

  const changeTopologyZoom = (delta) => {
    setTopologyZoom((current) => Math.max(0.5, Math.min(1.75, Number((current + delta).toFixed(2)))));
  };

  const addDevice = (typeOverride = newType, position = null) => {
    const id = `${typeOverride}-${Date.now().toString(36)}`;
    const typeInfo = DEVICE_TYPES[typeOverride];
    const created = {
      id,
      type: typeOverride,
      name: `${typeInfo.label} ${devices.filter((device) => device.type === typeOverride).length + 1}`,
      x: position?.x ?? 140 + (devices.length % 4) * 180,
      y: position?.y ?? 330 + Math.floor(devices.length / 4) * 115,
      gateway: '',
      interfaces: Array.from({ length: typeInfo.defaultPorts }, (_, index) => iface(id, index, typeOverride === 'switch' ? `fa0/${index + 1}` : `eth${index}`)),
      arp: {},
      routes: [],
      natTranslations: [],
    };
    setDevices((items) => [...items, created]);
    setSelectedId(id);
    if (typeOverride !== 'switch') {
      setPingDraft((current) => ({ ...current, source: id }));
    }
    setPingVisual({ nodes: {}, links: {} });
    setContextMenu(null);
  };

  const duplicateDevice = (deviceId) => {
    const source = getDevice(devices, deviceId);
    if (!source) return;
    const id = `${source.type}-${Date.now().toString(36)}`;
    const interfaceIdByOldId = new Map(source.interfaces.map((nic, index) => [nic.id, `${id}-if-${index}`]));
    const created = {
      ...source,
      id,
      name: `${source.name} copy`,
      x: source.x + 36,
      y: source.y + 36,
      interfaces: source.interfaces.map((nic, index) => ({
        ...nic,
        id: `${id}-if-${index}`,
        mac: deterministicMac(`${id}-${index}`),
      })),
      arp: { ...source.arp },
      natTranslations: [],
      routes: source.routes.map((route) => ({
        ...route,
        id: `${route.id}-${Date.now().toString(36)}`,
        interfaceId: interfaceIdByOldId.get(route.interfaceId) || '',
      })),
    };
    setDevices((items) => [...items, created]);
    setSelectedId(id);
    if (created.type !== 'switch') {
      setPingDraft((current) => ({ ...current, source: id }));
    }
    setPingVisual({ nodes: {}, links: {} });
    setContextMenu(null);
  };

  const removeDevice = (deviceId) => {
    setDevices((items) => items.filter((item) => item.id !== deviceId));
    setLinks((items) => items.filter((item) => item.a.deviceId !== deviceId && item.b.deviceId !== deviceId));
    setPingVisual({ nodes: {}, links: {} });
    setContextMenu(null);
  };

  const updateDevice = (deviceId, patch) => {
    setDevices((items) => items.map((item) => (item.id === deviceId ? { ...item, ...patch } : item)));
  };

  const updateInterface = (deviceId, interfaceId, patch) => {
    setDevices((items) =>
      items.map((device) =>
        device.id === deviceId
          ? { ...device, interfaces: device.interfaces.map((nic) => (nic.id === interfaceId ? { ...nic, ...patch } : nic)) }
          : device,
      ),
    );
  };

  const addInterface = (deviceId) => {
    setDevices((items) =>
      items.map((device) => {
        if (device.id !== deviceId) return device;
        const index = device.interfaces.length;
        const name = device.type === 'switch' ? `fa0/${index + 1}` : `eth${index}`;
        return { ...device, interfaces: [...device.interfaces, iface(device.id, index, name)] };
      }),
    );
    setContextMenu(null);
  };

  const clearDeviceArp = (deviceId) => {
    setDevices((items) => items.map((device) => (device.id === deviceId ? { ...device, arp: {} } : device)));
    setContextMenu(null);
  };

  const clearNatTranslations = (deviceId) => {
    setDevices((items) => items.map((device) => (device.id === deviceId ? { ...device, natTranslations: [] } : device)));
  };

  const setPingSource = (deviceId) => {
    setPingDraft((current) => ({ ...current, source: deviceId }));
    selectDevice(deviceId);
    setContextMenu(null);
  };

  const getFreeInterface = (deviceId, occupiedSet = occupied) => {
    const device = getDevice(devices, deviceId);
    return device?.interfaces.find((nic) => !occupiedSet.has(endpointKey({ deviceId, interfaceId: nic.id })));
  };

  const patchCableBetween = (sourceDeviceId, targetDeviceId) => {
    if (!sourceDeviceId || !targetDeviceId || sourceDeviceId === targetDeviceId) return;
    const currentOccupied = occupiedInterfaces(links);
    const sourceNic = getFreeInterface(sourceDeviceId, currentOccupied);
    const targetNic = getFreeInterface(targetDeviceId, currentOccupied);
    const sourceDevice = getDevice(devices, sourceDeviceId);
    const targetDevice = getDevice(devices, targetDeviceId);
    if (!sourceNic || !targetNic || !sourceDevice || !targetDevice) {
      setLog((items) => [
        { id: `log-${Date.now()}`, ok: false, title: 'Patch cable failed', lines: ['Both devices need at least one free port.'] },
        ...items,
      ]);
      setContextMenu(null);
      return;
    }
    setLinks((items) => [...items, link(sourceDeviceId, sourceNic.id, targetDeviceId, targetNic.id)]);
    setPingVisual({ nodes: {}, links: {} });
    setLog((items) => [
      { id: `log-${Date.now()}`, ok: true, title: 'Patch cable added', lines: [`Connected ${sourceDevice.name}:${sourceNic.name} to ${targetDevice.name}:${targetNic.name}.`] },
      ...items,
    ]);
    setContextMenu(null);
  };

  const executePing = (sourceDeviceId, destinationIp) => {
    const cleanDestination = destinationIp.trim();
    const result = simulatePing(devices, links, sourceDeviceId, cleanDestination);
    setDevices((items) => applyArpUpdates(items, result.updates));
    setPingVisual(result.visual || { nodes: {}, links: {} });
    setPingDraft((current) => ({ ...current, source: sourceDeviceId, destination: cleanDestination }));
    const source = getDevice(devices, sourceDeviceId)?.name || 'Unknown';
    setLog((items) => [
      {
        id: `log-${Date.now()}`,
        ok: result.ok,
        title: `${source} -> ${cleanDestination} ${result.ok ? 'succeeded' : 'failed'}`,
        lines: result.trace,
      },
      ...items,
    ]);
    return result;
  };

  const pingDeviceFromSelected = (sourceDeviceId, targetDeviceId) => {
    const source = getDevice(devices, sourceDeviceId);
    const target = getDevice(devices, targetDeviceId);
    const destinationIp = firstConfiguredIp(target);
    if (!source || source.type === 'switch' || !destinationIp) {
      setLog((items) => [
        { id: `log-${Date.now()}`, ok: false, title: 'Ping not started', lines: ['Select a host/router source and right-click a host/router with a configured IP.'] },
        ...items,
      ]);
      setContextMenu(null);
      return;
    }
    selectDevice(sourceDeviceId);
    executePing(sourceDeviceId, destinationIp);
    setContextMenu(null);
  };

  const getBoardPoint = (event) => {
    const rect = boardRef.current.getBoundingClientRect();
    const logicalWidth = rect.width / topologyZoom;
    const logicalHeight = rect.height / topologyZoom;
    return {
      x: Math.max(20, Math.min(logicalWidth - 120, (event.clientX - rect.left) / topologyZoom - 56)),
      y: Math.max(20, Math.min(logicalHeight - 90, (event.clientY - rect.top) / topologyZoom - 40)),
    };
  };

  const openCanvasMenu = (event) => {
    event.preventDefault();
    setContextMenu({ kind: 'canvas', x: event.clientX, y: event.clientY, boardPoint: getBoardPoint(event) });
  };

  const openDeviceMenu = (event, deviceId) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ kind: 'device', x: event.clientX, y: event.clientY, deviceId, selectedDeviceId: selectedId });
  };

  const addLink = () => {
    const { fromDevice, fromInterface, toDevice, toInterface } = linkDraft;
    if (!fromDevice || !fromInterface || !toDevice || !toInterface || fromDevice === toDevice) return;
    const a = { deviceId: fromDevice, interfaceId: fromInterface };
    const b = { deviceId: toDevice, interfaceId: toInterface };
    if (occupied.has(endpointKey(a)) || occupied.has(endpointKey(b))) return;
    setLinks((items) => [...items, link(fromDevice, fromInterface, toDevice, toInterface)]);
    setLinkDraft({ fromDevice: '', fromInterface: '', toDevice: '', toInterface: '' });
    setPingVisual({ nodes: {}, links: {} });
  };

  const removeLink = (linkId) => {
    setLinks((items) => items.filter((item) => item.id !== linkId));
    setPingVisual({ nodes: {}, links: {} });
  };

  const addManualArp = (deviceId) => {
    const ip = window.prompt('IP address to map');
    if (!ip || parseIPv4(ip) === null) return;
    const mac = window.prompt('MAC address for this IP');
    if (!mac) return;
    setDevices((items) => items.map((device) => (device.id === deviceId ? { ...device, arp: { ...device.arp, [ip]: mac } } : device)));
  };

  const clearArp = (deviceId, ip) => {
    setDevices((items) =>
      items.map((device) => {
        if (device.id !== deviceId) return device;
        const next = { ...device.arp };
        delete next[ip];
        return { ...device, arp: next };
      }),
    );
  };

  const addRoute = (deviceId) => {
    setDevices((items) =>
      items.map((device) => {
        if (device.id !== deviceId) return device;
        return { ...device, routes: [...device.routes, { id: `route-${Date.now()}`, network: '', mask: '255.255.255.0', nextHop: '', interfaceId: '' }] };
      }),
    );
  };

  const updateRoute = (deviceId, routeId, patch) => {
    setDevices((items) =>
      items.map((device) =>
        device.id === deviceId ? { ...device, routes: device.routes.map((route) => (route.id === routeId ? { ...route, ...patch } : route)) } : device,
      ),
    );
  };

  const removeRoute = (deviceId, routeId) => {
    setDevices((items) =>
      items.map((device) => (device.id === deviceId ? { ...device, routes: device.routes.filter((route) => route.id !== routeId) } : device)),
    );
  };

  const runPing = () => {
    executePing(pingDraft.source, pingDraft.destination);
  };

  const clearPacketTrace = () => {
    setLog([]);
    setPingVisual({ nodes: {}, links: {} });
  };

  const exportTopology = async () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      devices,
      links,
      awsTopology,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setLog((items) => [
        { id: `log-${Date.now()}`, ok: true, title: 'Topology exported', lines: ['JSON topology copied to clipboard.'] },
        ...items,
      ]);
    } catch (error) {
      setLog((items) => [
        { id: `log-${Date.now()}`, ok: false, title: 'Export failed', lines: [error.message || 'Clipboard write failed.'] },
        ...items,
      ]);
    }
  };

  const loadTopology = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const imported = validateTopologyPayload(JSON.parse(text));
      if (!window.confirm('Replace the current topology with the JSON from your clipboard?')) return;
      const firstDevice = imported.devices[0];
      const firstPingSource = imported.devices.find((device) => device.type !== 'switch') || firstDevice;
      setDevices(imported.devices);
      setLinks(imported.links);
      if (imported.awsTopology) setAwsTopology(imported.awsTopology);
      setPingVisual({ nodes: {}, links: {} });
      setSelectedId(firstDevice?.id || '');
      setLinkDraft({ fromDevice: '', fromInterface: '', toDevice: '', toInterface: '' });
      setPingDraft((current) => ({ ...current, source: firstPingSource?.id || '', destination: current.destination }));
      setLog((items) => [
        { id: `log-${Date.now()}`, ok: true, title: 'Topology loaded', lines: [`Loaded ${imported.devices.length} devices and ${imported.links.length} links from clipboard.`] },
        ...items,
      ]);
    } catch (error) {
      setLog((items) => [
        { id: `log-${Date.now()}`, ok: false, title: 'Load failed', lines: [error.message || 'Clipboard JSON could not be loaded.'] },
        ...items,
      ]);
    }
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="title-stack">
          <h1>Network Playground</h1>
          <div className="mode-tabs" role="tablist" aria-label="Lab mode">
            <button className={labMode === 'ethernet' ? 'active' : ''} onClick={() => setLabMode('ethernet')}>Ethernet Lab</button>
            <button className={labMode === 'aws' ? 'active' : ''} onClick={() => setLabMode('aws')}>AWS Lab</button>
          </div>
        </div>
        {labMode === 'ethernet' && (
          <div className="quick-actions" aria-label="Add device">
            <select value={newType} onChange={(event) => setNewType(event.target.value)}>
              {Object.entries(DEVICE_TYPES).map(([key, value]) => (
                <option key={key} value={key}>{value.label}</option>
              ))}
            </select>
            <button onClick={() => addDevice()}>Add device</button>
            <button className="ghost" onClick={exportTopology}>Export JSON</button>
            <button className="ghost" onClick={loadTopology}>Load JSON</button>
          </div>
        )}
      </header>

      {labMode === 'ethernet' ? <>
      <section className="workspace">
        <div className="canvas-card">
          <div className="card-heading">
            <div className="topology-title">
              <h2>Topology</h2>
              <span>{devices.length} devices / {links.length} links</span>
            </div>
            <div className="zoom-controls" aria-label="Topology zoom controls">
              <label className="inline-toggle">
                <input type="checkbox" checked={showEndpointLabels} onChange={(event) => setShowEndpointLabels(event.target.checked)} />
                Labels
              </label>
              <button className="ghost" onClick={() => changeTopologyZoom(-0.1)} aria-label="Zoom out">-</button>
              <span>{Math.round(topologyZoom * 100)}%</span>
              <button className="ghost" onClick={() => changeTopologyZoom(0.1)} aria-label="Zoom in">+</button>
              <button className="ghost" onClick={() => setTopologyZoom(1)}>Reset</button>
            </div>
          </div>
          <div ref={boardRef} className="board" onContextMenu={openCanvasMenu}>
            <div className="board-content" style={{ transform: `scale(${topologyZoom})` }}>
              <svg className="links" aria-hidden="true">
                {links.map((item) => {
                  const a = getDevice(devices, item.a.deviceId);
                  const b = getDevice(devices, item.b.deviceId);
                  if (!a || !b) return null;
                  return <line key={item.id} className={pingVisual.links[item.id] || ''} x1={a.x + 56} y1={a.y + 40} x2={b.x + 56} y2={b.y + 40} />;
                })}
              </svg>
              {showEndpointLabels && links.flatMap((item) => {
                const a = getDevice(devices, item.a.deviceId);
                const b = getDevice(devices, item.b.deviceId);
                const aNic = getInterface(devices, item.a.deviceId, item.a.interfaceId);
                const bNic = getInterface(devices, item.b.deviceId, item.b.interfaceId);
                if (!a || !b || !aNic || !bNic) return [];
                return [
                  a.type !== 'switch' ? <EndpointLabel key={`${item.id}-a`} device={a} otherDevice={b} nic={aNic} /> : null,
                  b.type !== 'switch' ? <EndpointLabel key={`${item.id}-b`} device={b} otherDevice={a} nic={bNic} /> : null,
                ].filter(Boolean);
              })}
              {devices.map((device) => {
                const type = DEVICE_TYPES[device.type];
                const configured = device.interfaces.filter((nic) => nic.ip).length;
                return (
                  <button
                    key={device.id}
                    className={`node ${selected?.id === device.id ? 'selected' : ''} ${pingVisual.nodes[device.id] || ''}`}
                    style={{ left: device.x, top: device.y, '--accent': type.color }}
                    onClick={() => selectDevice(device.id)}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      const rect = event.currentTarget.getBoundingClientRect();
                      setDragging({ id: device.id, offsetX: (event.clientX - rect.left) / topologyZoom, offsetY: (event.clientY - rect.top) / topologyZoom });
                    }}
                    onContextMenu={(event) => openDeviceMenu(event, device.id)}
                  >
                    <span>{type.icon}</span>
                    <strong>{device.name}</strong>
                    <small>{configured}/{device.interfaces.length} IP ports</small>
                  </button>
                );
              })}
            </div>
            {contextMenu && (
              <TopologyContextMenu
                menu={contextMenu}
                device={contextMenu.deviceId ? getDevice(devices, contextMenu.deviceId) : null}
                selectedDevice={contextMenu.selectedDeviceId ? getDevice(devices, contextMenu.selectedDeviceId) : null}
                canPatchCable={Boolean(
                  contextMenu.deviceId &&
                    contextMenu.selectedDeviceId &&
                    contextMenu.deviceId !== contextMenu.selectedDeviceId &&
                    getFreeInterface(contextMenu.selectedDeviceId) &&
                    getFreeInterface(contextMenu.deviceId)
                )}
                canPingDevice={Boolean(
                  contextMenu.deviceId &&
                    contextMenu.selectedDeviceId &&
                    contextMenu.deviceId !== contextMenu.selectedDeviceId &&
                    getDevice(devices, contextMenu.selectedDeviceId)?.type !== 'switch' &&
                    firstConfiguredIp(getDevice(devices, contextMenu.deviceId))
                )}
                onAddDevice={addDevice}
                onSelectDevice={(deviceId) => {
                  selectDevice(deviceId);
                  setContextMenu(null);
                }}
                onPatchCable={patchCableBetween}
                onPingDevice={pingDeviceFromSelected}
                onSetPingSource={setPingSource}
                onAddInterface={addInterface}
                onDuplicateDevice={duplicateDevice}
                onClearArp={clearDeviceArp}
                onDeleteDevice={removeDevice}
              />
            )}
          </div>
        </div>

        <aside className="side-panel">
          {selected && (
            <DeviceEditor
              device={selected}
              links={links}
              occupied={occupied}
              onUpdate={updateDevice}
              onUpdateInterface={updateInterface}
              onAddInterface={addInterface}
              onRemoveDevice={removeDevice}
              onAddArp={addManualArp}
              onClearArp={clearArp}
              onClearNat={clearNatTranslations}
              onAddRoute={addRoute}
              onUpdateRoute={updateRoute}
              onRemoveRoute={removeRoute}
            />
          )}
        </aside>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <h2>Patch Cables</h2>
          <div className="link-builder">
            <EndpointPicker label="From" devices={devices} occupied={occupied} draft={linkDraft} side="from" setDraft={setLinkDraft} />
            <EndpointPicker label="To" devices={devices} occupied={occupied} draft={linkDraft} side="to" setDraft={setLinkDraft} />
            <button onClick={addLink}>Connect</button>
          </div>
          <div className="table-list">
            {links.map((item) => (
              <div key={item.id} className="row-item">
                <span>{formatEndpoint(devices, item.a)} <b>to</b> {formatEndpoint(devices, item.b)}</span>
                <button className="ghost" onClick={() => removeLink(item.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel ping-panel">
          <h2>Send Ping</h2>
          <label>
            Source device
            <select value={pingDraft.source} onChange={(event) => setPingDraft({ ...pingDraft, source: event.target.value })}>
              {devices.filter((device) => device.type !== 'switch').map((device) => (
                <option key={device.id} value={device.id}>{device.name}</option>
              ))}
            </select>
          </label>
          <label>
            Destination IP
            <input value={pingDraft.destination} onChange={(event) => setPingDraft({ ...pingDraft, destination: event.target.value })} placeholder="192.168.1.20" />
          </label>
          <button onClick={runPing}>Run ICMP echo</button>
        </div>

        <div className="panel log-panel">
          <div className="card-heading compact">
            <h2>Packet Trace</h2>
            <button className="ghost" onClick={clearPacketTrace}>Clear</button>
          </div>
          <div className="log-stack">
            {log.map((entry) => (
              <article key={entry.id} className={`log-entry ${entry.ok ? 'ok' : 'bad'}`}>
                <strong>{entry.title}</strong>
                {entry.lines.map((line, index) => <p key={`${entry.id}-${index}`}>{line}</p>)}
              </article>
            ))}
          </div>
        </div>
      </section>
      </> : <AwsLab aws={awsTopology} setAws={setAwsTopology} />}
    </main>
  );
}

function EndpointLabel({ device, otherDevice, nic }) {
  const rightSide = otherDevice.x >= device.x;
  const verticalOffset = otherDevice.y > device.y + 35 ? 28 : otherDevice.y < device.y - 35 ? -34 : -8;
  return (
    <div
      className={`endpoint-label ${rightSide ? 'right' : 'left'}`}
      style={{ left: rightSide ? device.x + 116 : device.x - 6, top: device.y + 34 + verticalOffset }}
    >
      <span className="endpoint-name">{nic.name}</span>
      <FormattedIp ip={nic.ip} mask={nic.mask} />
    </div>
  );
}

function FormattedIp({ ip, mask }) {
  const parts = ipPrefixParts(ip, mask);
  if (!parts) return <span className="endpoint-ip muted-ip">no IP</span>;

  return (
    <span className="endpoint-ip" title={`/${parts.bits}`}>
      {parts.octets.map((octet, index) => {
        const isNetwork = index < parts.fullOctets;
        const isPartial = index === parts.fullOctets && parts.hasPartialOctet;
        const className = isNetwork ? 'ip-network' : isPartial ? 'ip-partial' : 'ip-host';
        return (
          <span key={`${octet}-${index}`} className={className}>
            {octet}{index < 3 ? '.' : ''}
          </span>
        );
      })}
      <span className="ip-prefix">/{parts.bits}</span>
    </span>
  );
}

function AwsLab({ aws, setAws }) {
  const [selectedId, setSelectedId] = useState('vpc-main');
  const [traffic, setTraffic] = useState({ source: 'internet', target: 'alb-public', protocol: 'HTTP' });
  const [trace, setTrace] = useState([{ id: 'aws-welcome', ok: true, title: 'AWS Lab ready', lines: ['Try Internet -> Public ALB over HTTP, App EC2 -> Internet over HTTP, or App EC2 -> Database EC2 over MYSQL.'] }]);
  const [visual, setVisual] = useState({ resources: {}, subnets: {}, vpcs: {}, routes: {} });

  const resources = [
    { id: 'internet', name: 'Internet', type: 'internet' },
    ...aws.loadBalancers.map((item) => ({ ...item, type: 'alb' })),
    ...aws.instances.map((item) => ({ ...item, type: 'ec2' })),
  ];
  const selected = findAwsResource(aws, selectedId);

  const updateAwsCollectionItem = (collection, id, patch) => {
    setAws((current) => ({
      ...current,
      [collection]: current[collection].map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateRoute = (routeTableId, index, patch) => {
    setAws((current) => ({
      ...current,
      routeTables: current.routeTables.map((table) =>
        table.id === routeTableId
          ? { ...table, routes: table.routes.map((route, routeIndex) => (routeIndex === index ? { ...route, ...patch } : route)) }
          : table,
      ),
    }));
  };

  const runAwsTraffic = () => {
    const result = simulateAwsTraffic(aws, traffic.source, traffic.target, traffic.protocol);
    const source = findAwsResource(aws, traffic.source)?.name || 'Unknown';
    const target = findAwsResource(aws, traffic.target)?.name || 'Unknown';
    setVisual(result.visual);
    setTrace((items) => [{ id: `aws-${Date.now()}`, ok: result.ok, title: `${source} -> ${target} ${result.ok ? 'allowed' : 'blocked'}`, lines: result.trace }, ...items]);
  };

  const resetAws = () => {
    setAws(cloneAwsTopology());
    setSelectedId('vpc-main');
    setVisual({ resources: {}, subnets: {}, vpcs: {}, routes: {} });
    setTrace([{ id: `aws-reset-${Date.now()}`, ok: true, title: 'AWS topology reset', lines: ['Default VPC scenario restored.'] }]);
  };

  const awsLines = [
    ['internet', 'igw-main'],
    ['igw-main', 'alb-public'],
    ['alb-public', 'ec2-app'],
    ['ec2-app', 'ec2-db'],
    ['ec2-app', 'nat-public'],
    ['nat-public', 'igw-main'],
  ];

  return (
    <>
      <section className="aws-workspace">
        <div className="canvas-card">
          <div className="card-heading">
            <div className="topology-title">
              <h2>AWS VPC Topology</h2>
              <span>{aws.vpcs.length} VPC / {aws.subnets.length} subnets / {aws.instances.length} EC2</span>
            </div>
            <button className="ghost" onClick={resetAws}>Reset AWS</button>
          </div>
          <div className="aws-board">
            <svg className="aws-lines" aria-hidden="true">
              {awsLines.map(([fromId, toId]) => {
                const from = findAwsResource(aws, fromId);
                const to = findAwsResource(aws, toId);
                if (!from || !to) return null;
                const active = visual.resources[fromId] && visual.resources[toId] ? visual.resources[toId] : '';
                return <line key={`${fromId}-${toId}`} className={active} x1={(from.x || 0) + 42} y1={(from.y || 0) + 28} x2={(to.x || 0) + 42} y2={(to.y || 0) + 28} />;
              })}
            </svg>
            <button className={`aws-node internet ${visual.resources.internet || ''}`} style={{ left: 25, top: 40 }} onClick={() => setSelectedId('internet')}>Internet</button>
            {aws.vpcs.map((vpc) => (
              <button key={vpc.id} className={`aws-vpc ${visual.vpcs[vpc.id] || ''} ${selectedId === vpc.id ? 'selected' : ''}`} style={{ left: vpc.x, top: vpc.y, width: vpc.width, height: vpc.height }} onClick={() => setSelectedId(vpc.id)}>
                <strong>{vpc.name}</strong><span>{vpc.cidr}</span>
              </button>
            ))}
            {aws.subnets.map((subnet) => (
              <button key={subnet.id} className={`aws-subnet ${visual.subnets[subnet.id] || ''} ${selectedId === subnet.id ? 'selected' : ''}`} style={{ left: subnet.x, top: subnet.y, width: subnet.width, height: subnet.height }} onClick={() => setSelectedId(subnet.id)}>
                <strong>{subnet.name}</strong><span>{subnet.cidr} / {subnet.az}</span>
              </button>
            ))}
            {aws.gateways.map((gateway) => (
              <button key={gateway.id} className={`aws-node gateway ${visual.resources[gateway.id] || ''} ${selectedId === gateway.id ? 'selected' : ''}`} style={{ left: gateway.x, top: gateway.y }} onClick={() => setSelectedId(gateway.id)}>
                <span>{gateway.type.toUpperCase()}</span><strong>{gateway.name}</strong>
              </button>
            ))}
            {aws.loadBalancers.map((lb) => (
              <button key={lb.id} className={`aws-node alb ${visual.resources[lb.id] || ''} ${selectedId === lb.id ? 'selected' : ''}`} style={{ left: lb.x, top: lb.y }} onClick={() => setSelectedId(lb.id)}>
                <span>ALB</span><strong>{lb.name}</strong><small>{lb.dnsName}</small>
              </button>
            ))}
            {aws.instances.map((instance) => (
              <button key={instance.id} className={`aws-node ec2 ${visual.resources[instance.id] || ''} ${selectedId === instance.id ? 'selected' : ''}`} style={{ left: instance.x, top: instance.y }} onClick={() => setSelectedId(instance.id)}>
                <span>EC2</span><strong>{instance.name}</strong><small>{instance.privateIp}</small>
              </button>
            ))}
          </div>
        </div>

        <aside className="panel aws-editor">
          <AwsResourceEditor aws={aws} selected={selected} onUpdate={updateAwsCollectionItem} />
        </aside>
      </section>

      <section className="aws-bottom-grid">
        <div className="panel ping-panel">
          <h2>AWS Traffic</h2>
          <label>
            Source
            <select value={traffic.source} onChange={(event) => setTraffic({ ...traffic, source: event.target.value })}>
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
            </select>
          </label>
          <label>
            Target
            <select value={traffic.target} onChange={(event) => setTraffic({ ...traffic, target: event.target.value })}>
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}
            </select>
          </label>
          <label>
            Protocol
            <select value={traffic.protocol} onChange={(event) => setTraffic({ ...traffic, protocol: event.target.value })}>
              <option value="HTTP">HTTP :80</option>
              <option value="ICMP">ICMP</option>
              <option value="MYSQL">MYSQL :3306</option>
            </select>
          </label>
          <button onClick={runAwsTraffic}>Simulate AWS path</button>
        </div>

        <div className="panel aws-routes-panel">
          <h2>Route Tables</h2>
          <div className="aws-route-list">
            {aws.routeTables.map((table) => (
              <div key={table.id} className={`aws-table-card ${visual.routes[table.id] || ''}`}>
                <strong>{table.name}</strong>
                {table.routes.map((route, index) => (
                  <div key={`${table.id}-${index}`} className="aws-route-row">
                    <input value={route.destination} onChange={(event) => updateRoute(table.id, index, { destination: event.target.value })} />
                    <input value={route.target} onChange={(event) => updateRoute(table.id, index, { target: event.target.value })} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="panel log-panel">
          <div className="card-heading compact">
            <h2>AWS Trace</h2>
            <button className="ghost" onClick={() => { setTrace([]); setVisual({ resources: {}, subnets: {}, vpcs: {}, routes: {} }); }}>Clear</button>
          </div>
          <div className="log-stack">
            {trace.map((entry) => (
              <article key={entry.id} className={`log-entry ${entry.ok ? 'ok' : 'bad'}`}>
                <strong>{entry.title}</strong>
                {entry.lines.map((line, index) => <p key={`${entry.id}-${index}`}>{line}</p>)}
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function AwsResourceEditor({ aws, selected, onUpdate }) {
  if (!selected) return <p className="muted">Select an AWS object.</p>;
  const collection = selected.type === 'alb' ? 'loadBalancers' : selected.type === 'igw' || selected.type === 'nat' ? 'gateways' : selected.privateIp !== undefined ? 'instances' : selected.cidr && selected.routeTableId ? 'subnets' : selected.cidr ? 'vpcs' : null;
  const securityGroups = selected.securityGroupIds?.map((id) => aws.securityGroups.find((group) => group.id === id)).filter(Boolean) || [];
  const subnet = awsSubnetOf(aws, selected);
  const routeTable = selected.routeTableId ? aws.routeTables.find((table) => table.id === selected.routeTableId) : subnet ? awsRouteTableForSubnet(aws, subnet.id) : null;

  if (selected.id === 'internet') {
    return (
      <>
        <h2>Internet</h2>
        <p className="muted">External clients can reach public IPs, internet-facing ALBs, and resources routed through an Internet Gateway.</p>
      </>
    );
  }

  return (
    <>
      <div className="card-heading compact">
        <div>
          <h2>AWS Resource</h2>
          <p>{selected.type || 'network'}</p>
        </div>
      </div>
      {collection && (
        <label>
          Name
          <input value={selected.name} onChange={(event) => onUpdate(collection, selected.id, { name: event.target.value })} />
        </label>
      )}
      {'cidr' in selected && collection && (
        <label>
          CIDR
          <input value={selected.cidr} onChange={(event) => onUpdate(collection, selected.id, { cidr: event.target.value })} />
        </label>
      )}
      {'privateIp' in selected && collection && (
        <div className="two-field-grid">
          <label>
            Private IP
            <input value={selected.privateIp || ''} onChange={(event) => onUpdate(collection, selected.id, { privateIp: event.target.value })} />
          </label>
          <label>
            Public IP
            <input value={selected.publicIp || ''} onChange={(event) => onUpdate(collection, selected.id, { publicIp: event.target.value })} />
          </label>
        </div>
      )}
      {subnet && <p className="muted">Subnet: {subnet.name} ({subnet.cidr})</p>}
      {routeTable && <p className="muted">Route table: {routeTable.name}</p>}
      {!!securityGroups.length && (
        <section>
          <h3>Security Groups</h3>
          <div className="table-list">
            {securityGroups.map((group) => (
              <div key={group.id} className="aws-table-card">
                <strong>{group.name}</strong>
                <p>Inbound: {group.inbound.map((rule) => `${rule.protocol} from ${rule.source}`).join(', ') || 'none'}</p>
                <p>Outbound: {group.outbound.map((rule) => `${rule.protocol} to ${rule.destination}`).join(', ') || 'none'}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      {selected.targetIds?.length > 0 && <p className="muted">Targets: {selected.targetIds.map((id) => findAwsResource(aws, id)?.name || id).join(', ')}</p>}
    </>
  );
}

function TopologyContextMenu({ menu, device, selectedDevice, canPatchCable, canPingDevice, onAddDevice, onSelectDevice, onPatchCable, onPingDevice, onSetPingSource, onAddInterface, onDuplicateDevice, onClearArp, onDeleteDevice }) {
  const style = { left: menu.x, top: menu.y };

  if (menu.kind === 'canvas') {
    return (
      <div className="context-menu" style={style} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
        <strong>Add device here</strong>
        <button onClick={() => onAddDevice('host', menu.boardPoint)}>Host</button>
        <button onClick={() => onAddDevice('switch', menu.boardPoint)}>Switch</button>
        <button onClick={() => onAddDevice('router', menu.boardPoint)}>Router</button>
      </div>
    );
  }

  if (!device) return null;
  const arpCount = Object.keys(device.arp || {}).length;

  return (
    <div className="context-menu" style={style} onClick={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      <strong>{device.name}</strong>
      {selectedDevice && selectedDevice.id !== device.id && (
        <button disabled={!canPatchCable} onClick={() => onPatchCable(selectedDevice.id, device.id)}>
          Patch cable from {selectedDevice.name}
        </button>
      )}
      {selectedDevice && selectedDevice.id !== device.id && (
        <button disabled={!canPingDevice} onClick={() => onPingDevice(selectedDevice.id, device.id)}>
          Ping from {selectedDevice.name}
        </button>
      )}
      <button onClick={() => onSelectDevice(device.id)}>Select</button>
      {device.type !== 'switch' && <button onClick={() => onSetPingSource(device.id)}>Use as ping source</button>}
      <button onClick={() => onAddInterface(device.id)}>Add port</button>
      <button onClick={() => onDuplicateDevice(device.id)}>Duplicate</button>
      {device.type !== 'switch' && <button disabled={!arpCount} onClick={() => onClearArp(device.id)}>Clear ARP ({arpCount})</button>}
      <button className="danger-item" onClick={() => onDeleteDevice(device.id)}>Delete</button>
    </div>
  );
}

function DeviceEditor({ device, links, occupied, onUpdate, onUpdateInterface, onAddInterface, onRemoveDevice, onAddArp, onClearArp, onClearNat, onAddRoute, onUpdateRoute, onRemoveRoute }) {
  return (
    <div className="panel device-editor">
      <div className="card-heading compact">
        <div>
          <h2>Device Config</h2>
          <p>{DEVICE_TYPES[device.type].label}</p>
        </div>
        <button className="danger" onClick={() => onRemoveDevice(device.id)}>Delete</button>
      </div>

      <div className={device.type === 'host' ? 'device-fields' : 'device-fields single'}>
        <label>
          Name
          <input value={device.name} onChange={(event) => onUpdate(device.id, { name: event.target.value })} />
        </label>

        {device.type === 'host' && (
          <label>
            Default gateway
            <input value={device.gateway} onChange={(event) => onUpdate(device.id, { gateway: event.target.value })} placeholder="192.168.1.1" />
          </label>
        )}
      </div>

      <div className="section-title">
        <h3>Interfaces</h3>
        <button className="ghost" onClick={() => onAddInterface(device.id)}>Add port</button>
      </div>

      <div className="interface-list">
        {device.interfaces.map((nic) => {
          const connected = occupied.has(endpointKey({ deviceId: device.id, interfaceId: nic.id }));
          const network = nic.ip && nic.mask ? networkOf(nic.ip, nic.mask) : null;
          return (
            <div key={nic.id} className="interface-card">
              <div className="interface-head">
                <input value={nic.name} onChange={(event) => onUpdateInterface(device.id, nic.id, { name: event.target.value })} />
                <span className={connected ? 'status live' : 'status'}>{connected ? 'linked' : 'down'}</span>
              </div>
              <div className={device.type === 'switch' ? 'interface-fields switch-fields' : device.type === 'router' ? 'interface-fields router-fields' : 'interface-fields'}>
                <label>
                  MAC
                  <input value={nic.mac} onChange={(event) => onUpdateInterface(device.id, nic.id, { mac: event.target.value })} />
                </label>
                {device.type !== 'switch' && (
                  <>
                    <label>
                      IP address
                      <input value={nic.ip} onChange={(event) => onUpdateInterface(device.id, nic.id, { ip: event.target.value })} placeholder="192.168.1.10" />
                    </label>
                    <label>
                      Mask
                      <input value={nic.mask} onChange={(event) => onUpdateInterface(device.id, nic.id, { mask: event.target.value })} placeholder="255.255.255.0 or /24" />
                    </label>
                    {device.type === 'router' && (
                      <label>
                        NAT role
                        <select value={nic.natRole || ''} onChange={(event) => onUpdateInterface(device.id, nic.id, { natRole: event.target.value })}>
                          <option value="">None</option>
                          <option value="inside">Inside</option>
                          <option value="outside">Outside</option>
                        </select>
                      </label>
                    )}
                  </>
                )}
              </div>
              {network && <small>Network {network}/{maskBits(nic.mask)}</small>}
            </div>
          );
        })}
      </div>

      {device.type === 'router' && (
        <section>
          <div className="section-title">
            <h3>Static Routes</h3>
            <button className="ghost" onClick={() => onAddRoute(device.id)}>Add route</button>
          </div>
          <div className="route-list">
            {device.routes.map((route) => (
              <div key={route.id} className="route-card">
                <input value={route.network} onChange={(event) => onUpdateRoute(device.id, route.id, { network: event.target.value })} placeholder="Network" />
                <input value={route.mask} onChange={(event) => onUpdateRoute(device.id, route.id, { mask: event.target.value })} placeholder="Mask" />
                <input value={route.nextHop} onChange={(event) => onUpdateRoute(device.id, route.id, { nextHop: event.target.value })} placeholder="Next hop" />
                <select value={route.interfaceId} onChange={(event) => onUpdateRoute(device.id, route.id, { interfaceId: event.target.value })}>
                  <option value="">Auto iface</option>
                  {device.interfaces.map((nic) => <option key={nic.id} value={nic.id}>{nic.name}</option>)}
                </select>
                <button className="ghost" onClick={() => onRemoveRoute(device.id, route.id)}>Remove</button>
              </div>
            ))}
            {!device.routes.length && <p className="muted">Connected routes are inferred from router interfaces.</p>}
          </div>
        </section>
      )}

      {device.type === 'router' && (
        <section>
          <div className="section-title">
            <h3>NAT Table</h3>
            <button className="ghost" onClick={() => onClearNat(device.id)}>Clear NAT</button>
          </div>
          <div className="table-list">
            {(device.natTranslations || []).map((translation) => (
              <div key={translation.id} className="row-item single">
                {translation.protocol} {translation.insideIp} <b>as</b> {translation.outsideIp} <b>to</b> {translation.destinationIp}
              </div>
            ))}
            {!(device.natTranslations || []).length && <p className="muted">No NAT translations yet. Mark one interface inside and another outside, then ping across them.</p>}
          </div>
        </section>
      )}

      {device.type !== 'switch' && (
        <section>
          <div className="section-title">
            <h3>ARP Table</h3>
            <button className="ghost" onClick={() => onAddArp(device.id)}>Add ARP</button>
          </div>
          <div className="table-list">
            {Object.entries(device.arp).map(([ip, mac]) => (
              <div key={ip} className="row-item">
                <span>{ip} <b>is at</b> {mac}</span>
                <button className="ghost" onClick={() => onClearArp(device.id, ip)}>Forget</button>
              </div>
            ))}
            {!Object.keys(device.arp).length && <p className="muted">No ARP entries yet.</p>}
          </div>
        </section>
      )}

      <section>
        <h3>Connected Links</h3>
        <div className="table-list">
          {links.filter((item) => item.a.deviceId === device.id || item.b.deviceId === device.id).map((item) => (
            <div key={item.id} className="row-item single">{formatEndpointForDevice(device, item.a, item.b)}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EndpointPicker({ label, devices, occupied, draft, side, setDraft }) {
  const deviceKey = `${side}Device`;
  const interfaceKey = `${side}Interface`;
  const device = devices.find((item) => item.id === draft[deviceKey]);
  const available = device?.interfaces.filter((nic) => !occupied.has(endpointKey({ deviceId: device.id, interfaceId: nic.id }))) || [];

  return (
    <div className="endpoint-picker">
      <span>{label}</span>
      <select value={draft[deviceKey]} onChange={(event) => setDraft((current) => ({ ...current, [deviceKey]: event.target.value, [interfaceKey]: '' }))}>
        <option value="">Device</option>
        {devices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select value={draft[interfaceKey]} onChange={(event) => setDraft((current) => ({ ...current, [interfaceKey]: event.target.value }))}>
        <option value="">Port</option>
        {available.map((nic) => <option key={nic.id} value={nic.id}>{nic.name}</option>)}
      </select>
    </div>
  );
}

function formatEndpoint(devices, endpoint) {
  const device = getDevice(devices, endpoint.deviceId);
  const nic = getInterface(devices, endpoint.deviceId, endpoint.interfaceId);
  return `${device?.name || 'Missing'}:${nic?.name || 'port'}`;
}

function formatEndpointForDevice(device, a, b) {
  const own = a.deviceId === device.id ? a : b;
  const other = a.deviceId === device.id ? b : a;
  const ownNic = device.interfaces.find((nic) => nic.id === own.interfaceId);
  return `${ownNic?.name || 'port'} connected to ${other.deviceId}`;
}

export default App;
