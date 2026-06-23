import { useEffect, useRef, useState } from 'react';

const DEVICE_TYPES = {
  host: { label: 'Host', icon: 'PC', color: '#48d597', defaultPorts: 1 },
  switch: { label: 'Switch', icon: 'SW', color: '#5aa7ff', defaultPorts: 6 },
  router: { label: 'Router', icon: 'RT', color: '#f7b955', defaultPorts: 2 },
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
    id: 'sw-1',
    type: 'switch',
    name: 'Access Switch',
    x: 390,
    y: 170,
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
      iface('r-1', 0, 'g0/0', '192.168.10.1', '255.255.255.0'),
      iface('r-1', 1, 'g0/1', '10.0.0.1', '255.255.255.0'),
    ],
    arp: {},
    routes: [],
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
  link('sw-1', 'sw-1-if-1', 'r-1', 'r-1-if-0'),
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

function chooseSourceInterface(device, destinationIp) {
  return (
    device.interfaces.find((nic) => nic.ip && nic.mask && sameSubnet(nic.ip, nic.mask, destinationIp)) ||
    device.interfaces.find((nic) => nic.ip && nic.mask)
  );
}

function simulatePing(devices, links, sourceDeviceId, destinationIp) {
  const trace = [];
  const source = getDevice(devices, sourceDeviceId);
  if (!source) return { ok: false, trace: ['Source device does not exist.'], updates: [] };
  if (parseIPv4(destinationIp) === null) return { ok: false, trace: ['Destination IP address is invalid.'], updates: [] };

  const sourceNic = chooseSourceInterface(source, destinationIp);
  if (!sourceNic) return { ok: false, trace: [`${source.name} has no configured IP interface.`], updates: [] };

  const updates = [];
  const visitedRouters = new Set();

  const arpResolve = (device, nic, targetIp) => {
    const endpoint = { deviceId: device.id, interfaceId: nic.id };
    const existing = device.arp[targetIp];
    if (existing) {
      trace.push(`${device.name} uses cached ARP ${targetIp} -> ${existing}.`);
    } else {
      trace.push(`${device.name} broadcasts ARP on ${nic.name}: who has ${targetIp}?`);
    }
    const target = findIpOnSegment(devices, links, endpoint, targetIp);
    if (!target) {
      trace.push(`No interface with ${targetIp} answered on that Ethernet segment.`);
      return null;
    }
    trace.push(`${target.device.name} replies with MAC ${target.nic.mac}.`);
    updates.push({ deviceId: device.id, ip: targetIp, mac: target.nic.mac });
    return target;
  };

  const deliverFromRouter = (router, destination) => {
    if (visitedRouters.has(router.id)) {
      trace.push(`Routing loop detected at ${router.name}.`);
      return false;
    }
    visitedRouters.add(router.id);

    const directNic = router.interfaces.find((nic) => nic.ip && nic.mask && sameSubnet(nic.ip, nic.mask, destination));
    if (directNic) {
      trace.push(`${router.name} has connected route ${networkOf(directNic.ip, directNic.mask)}/${maskBits(directNic.mask)} via ${directNic.name}.`);
      const finalTarget = arpResolve(router, directNic, destination);
      if (!finalTarget) return false;
      trace.push(`ICMP echo reaches ${finalTarget.device.name}; echo reply follows the reverse path.`);
      updates.push({ deviceId: finalTarget.device.id, ip: directNic.ip, mac: directNic.mac });
      return true;
    }

    const route = [...router.routes].filter((item) => routeMatches(item, destination)).sort((a, b) => maskBits(b.mask) - maskBits(a.mask))[0];
    if (!route) {
      trace.push(`${router.name} has no route to ${destination}.`);
      return false;
    }
    const outgoingNic = router.interfaces.find((nic) => nic.id === route.interfaceId) || router.interfaces.find((nic) => nic.ip && nic.mask && sameSubnet(nic.ip, nic.mask, route.nextHop));
    if (!outgoingNic) {
      trace.push(`${router.name} cannot choose an outgoing interface for route ${route.network}/${route.mask}.`);
      return false;
    }
    trace.push(`${router.name} forwards by static route ${route.network}/${route.mask} toward ${route.nextHop}.`);
    const nextHop = arpResolve(router, outgoingNic, route.nextHop);
    if (!nextHop) return false;
    if (nextHop.device.type !== 'router') {
      trace.push(`${nextHop.device.name} is not a router, so the packet stops.`);
      return false;
    }
    return deliverFromRouter(nextHop.device, destination);
  };

  const nextHopIp = sameSubnet(sourceNic.ip, sourceNic.mask, destinationIp) ? destinationIp : source.gateway;
  if (!nextHopIp) {
    return {
      ok: false,
      trace: [`${source.name} needs a default gateway to reach ${destinationIp}.`],
      updates: [],
    };
  }

  trace.push(`${source.name} sends ICMP echo from ${sourceNic.ip} to ${destinationIp}.`);
  const firstHop = arpResolve(source, sourceNic, nextHopIp);
  if (!firstHop) return { ok: false, trace, updates };

  if (firstHop.nic.ip === destinationIp) {
    trace.push(`ICMP echo reaches ${firstHop.device.name}; echo reply is delivered on the same Ethernet segment.`);
    updates.push({ deviceId: firstHop.device.id, ip: sourceNic.ip, mac: sourceNic.mac });
    return { ok: true, trace, updates };
  }

  if (firstHop.device.type !== 'router') {
    trace.push(`${firstHop.device.name} is not a router for off-subnet traffic.`);
    return { ok: false, trace, updates };
  }

  const ok = deliverFromRouter(firstHop.device, destinationIp);
  return { ok, trace, updates };
}

function applyArpUpdates(devices, updates) {
  if (!updates.length) return devices;
  return devices.map((device) => {
    const entries = updates.filter((item) => item.deviceId === device.id);
    if (!entries.length) return device;
    const nextArp = { ...device.arp };
    entries.forEach((item) => {
      nextArp[item.ip] = item.mac;
    });
    return { ...device, arp: nextArp };
  });
}

function App() {
  const [devices, setDevices] = useState(INITIAL_DEVICES);
  const [links, setLinks] = useState(INITIAL_LINKS);
  const [selectedId, setSelectedId] = useState(INITIAL_DEVICES[0].id);
  const [newType, setNewType] = useState('host');
  const [linkDraft, setLinkDraft] = useState({ fromDevice: '', fromInterface: '', toDevice: '', toInterface: '' });
  const [pingDraft, setPingDraft] = useState({ source: INITIAL_DEVICES[0].id, destination: '10.0.0.20' });
  const [log, setLog] = useState([
    { id: 'welcome', ok: true, title: 'Welcome', lines: ['Try pinging 10.0.0.20 from Workstation A, then inspect ARP tables.'] },
  ]);
  const [dragging, setDragging] = useState(null);
  const boardRef = useRef(null);

  const selected = devices.find((device) => device.id === selectedId) || devices[0];
  const occupied = occupiedInterfaces(links);

  useEffect(() => {
    if (!selected && devices[0]) setSelectedId(devices[0].id);
  }, [devices, selected]);

  useEffect(() => {
    const onMove = (event) => {
      if (!dragging || !boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      const x = Math.max(20, Math.min(rect.width - 120, event.clientX - rect.left - dragging.offsetX));
      const y = Math.max(20, Math.min(rect.height - 90, event.clientY - rect.top - dragging.offsetY));
      setDevices((items) => items.map((item) => (item.id === dragging.id ? { ...item, x, y } : item)));
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  const addDevice = () => {
    const id = `${newType}-${Date.now().toString(36)}`;
    const typeInfo = DEVICE_TYPES[newType];
    const created = {
      id,
      type: newType,
      name: `${typeInfo.label} ${devices.filter((device) => device.type === newType).length + 1}`,
      x: 140 + (devices.length % 4) * 180,
      y: 330 + Math.floor(devices.length / 4) * 115,
      gateway: '',
      interfaces: Array.from({ length: typeInfo.defaultPorts }, (_, index) => iface(id, index, newType === 'switch' ? `fa0/${index + 1}` : `eth${index}`)),
      arp: {},
      routes: [],
    };
    setDevices((items) => [...items, created]);
    setSelectedId(id);
  };

  const removeDevice = (deviceId) => {
    setDevices((items) => items.filter((item) => item.id !== deviceId));
    setLinks((items) => items.filter((item) => item.a.deviceId !== deviceId && item.b.deviceId !== deviceId));
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
  };

  const addLink = () => {
    const { fromDevice, fromInterface, toDevice, toInterface } = linkDraft;
    if (!fromDevice || !fromInterface || !toDevice || !toInterface || fromDevice === toDevice) return;
    const a = { deviceId: fromDevice, interfaceId: fromInterface };
    const b = { deviceId: toDevice, interfaceId: toInterface };
    if (occupied.has(endpointKey(a)) || occupied.has(endpointKey(b))) return;
    setLinks((items) => [...items, link(fromDevice, fromInterface, toDevice, toInterface)]);
    setLinkDraft({ fromDevice: '', fromInterface: '', toDevice: '', toInterface: '' });
  };

  const removeLink = (linkId) => setLinks((items) => items.filter((item) => item.id !== linkId));

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
    const result = simulatePing(devices, links, pingDraft.source, pingDraft.destination.trim());
    setDevices((items) => applyArpUpdates(items, result.updates));
    const source = getDevice(devices, pingDraft.source)?.name || 'Unknown';
    setLog((items) => [
      {
        id: `log-${Date.now()}`,
        ok: result.ok,
        title: `${source} -> ${pingDraft.destination.trim()} ${result.ok ? 'succeeded' : 'failed'}`,
        lines: result.trace,
      },
      ...items,
    ]);
  };

  return (
    <main className="app-shell">
      <header className="top-bar">
        <h1>Ethernet Network Playground</h1>
        <div className="quick-actions" aria-label="Add device">
          <select value={newType} onChange={(event) => setNewType(event.target.value)}>
            {Object.entries(DEVICE_TYPES).map(([key, value]) => (
              <option key={key} value={key}>{value.label}</option>
            ))}
          </select>
          <button onClick={addDevice}>Add device</button>
        </div>
      </header>

      <section className="workspace">
        <div className="canvas-card">
          <div className="card-heading">
            <div>
              <h2>Topology</h2>
              <p>Drag nodes, patch ports, then send traffic.</p>
            </div>
            <span>{devices.length} devices / {links.length} links</span>
          </div>
          <div ref={boardRef} className="board">
            <svg className="links" aria-hidden="true">
              {links.map((item) => {
                const a = getDevice(devices, item.a.deviceId);
                const b = getDevice(devices, item.b.deviceId);
                if (!a || !b) return null;
                return <line key={item.id} x1={a.x + 56} y1={a.y + 40} x2={b.x + 56} y2={b.y + 40} />;
              })}
            </svg>
            {devices.map((device) => {
              const type = DEVICE_TYPES[device.type];
              const configured = device.interfaces.filter((nic) => nic.ip).length;
              return (
                <button
                  key={device.id}
                  className={`node ${selected?.id === device.id ? 'selected' : ''}`}
                  style={{ left: device.x, top: device.y, '--accent': type.color }}
                  onClick={() => setSelectedId(device.id)}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    const rect = event.currentTarget.getBoundingClientRect();
                    setDragging({ id: device.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
                  }}
                >
                  <span>{type.icon}</span>
                  <strong>{device.name}</strong>
                  <small>{configured}/{device.interfaces.length} IP ports</small>
                </button>
              );
            })}
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
            <button className="ghost" onClick={() => setLog([])}>Clear</button>
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
    </main>
  );
}

function DeviceEditor({ device, links, occupied, onUpdate, onUpdateInterface, onAddInterface, onRemoveDevice, onAddArp, onClearArp, onAddRoute, onUpdateRoute, onRemoveRoute }) {
  return (
    <div className="panel device-editor">
      <div className="card-heading compact">
        <div>
          <h2>Device Config</h2>
          <p>{DEVICE_TYPES[device.type].label}</p>
        </div>
        <button className="danger" onClick={() => onRemoveDevice(device.id)}>Delete</button>
      </div>

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
              <label>
                MAC
                <input value={nic.mac} onChange={(event) => onUpdateInterface(device.id, nic.id, { mac: event.target.value })} />
              </label>
              {device.type !== 'switch' && (
                <div className="two-col">
                  <label>
                    IP address
                    <input value={nic.ip} onChange={(event) => onUpdateInterface(device.id, nic.id, { ip: event.target.value })} placeholder="192.168.1.10" />
                  </label>
                  <label>
                    Mask
                    <input value={nic.mask} onChange={(event) => onUpdateInterface(device.id, nic.id, { mask: event.target.value })} placeholder="255.255.255.0 or /24" />
                  </label>
                </div>
              )}
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
