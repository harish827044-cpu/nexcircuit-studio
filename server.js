const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'orders_db.json');
const CSV_FILE = path.join(__dirname, 'pcb_orders.csv');

function getOrders() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '[]');
  } catch (e) {
    return [];
  }
}

function saveOrders(orders) {
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

if (!fs.existsSync(CSV_FILE)) {
  const headers = 'Order ID,Date,Client Name,Phone,Project Title,Board Size,Components,Layers,Price,Status,Notes\n';
  fs.writeFileSync(CSV_FILE, headers, 'utf8');
}

// 1. API: PCB Order Save to Database & Excel
app.post('/api/pcb-order', (req, res) => {
  const { name, phone, projectTitle, powerSupply, mcu, inputs, outputs, communication, layers, boardSize, compCount, mounting, notes, fileName, estimatedPrice } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and Phone required' });

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const dateStr = new Date().toLocaleDateString('en-GB');
  const orderId = 'ORD-PCB-' + Date.now().toString().slice(-5);
  const price = estimatedPrice || '₹499';

  const newOrder = {
    orderId,
    name,
    phone: cleanPhone,
    projectTitle: projectTitle || 'Custom KiCad PCB',
    powerSupply: powerSupply || '5V USB',
    mcu: mcu || 'ESP32',
    inputs: inputs || 'Standard Inputs',
    outputs: outputs || 'Standard Outputs',
    communication: communication || 'Wi-Fi & BLE',
    boardSize: boardSize || 'Small (<50x50mm)',
    compCount: compCount || '<20 Components',
    layers: layers || '2-Layer',
    mounting: mounting || 'SMD',
    notes: notes || 'Standard specs',
    fileName: fileName || 'None',
    orderDate: dateStr,
    status: 'Order Received & Schematic Review',
    statusStep: 1,
    estimatedPrice: price,
    estimatedDelivery: '24 - 48 Hours'
  };

  const orders = getOrders();
  orders.unshift(newOrder);
  saveOrders(orders);

  const newCsvRow = `"${orderId}","${dateStr}","${(name||'').replace(/"/g,'""')}","${cleanPhone}","${(projectTitle||'').replace(/"/g,'""')}","${boardSize}","${compCount}","${layers}","${price}","Under Review","${(notes||'').replace(/"/g,'""')}"\n`;
  fs.appendFile(CSV_FILE, newCsvRow, 'utf8', () => {});

  res.json({ success: true, orderId, order: newOrder });
});

// 2. API: Track Order
app.get('/api/track-order', (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!query) return res.status(400).json({ error: 'Search query is required' });

  const orders = getOrders();
  const matched = orders.filter(o => 
    o.orderId.toLowerCase().replace(/[^a-z0-9]/g, '').includes(query) || 
    o.phone.includes(query)
  );

  if (matched.length === 0) {
    return res.status(404).json({ message: 'No orders found matching your details.' });
  }

  res.json({ success: true, orders: matched });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/download-pcb-orders', (req, res) => {
  if (fs.existsSync(CSV_FILE)) res.download(CSV_FILE, 'PCB_Orders_Database.csv');
  else res.status(404).send('No records yet.');
});

app.listen(PORT, () => {
  console.log(`Nex Circuit Design running on port ${PORT}`);
});