// Single source of truth for every section of the site.
// Edit text here; the components only handle layout.

export const person = {
  name: 'Saugat Karki',
  location: 'Starkville, MS',
  email: 'saugatka25@gmail.com',
  phone: '(662) 341-6739',
  linkedin: 'https://www.linkedin.com/in/saugat-karki-6545592aa/',
  github: 'https://github.com/126saugat126',
  intro:
    'Computer engineer working where software meets hardware: LiDAR perception, closed-loop control, motor drives and the tools that keep a production floor running.',
  // Drop files in /public/images and set the paths, e.g. 'images/headshot.jpg'
  photo: '',
};

export const education = {
  school: 'Mississippi State University',
  place: 'Starkville, MS',
  degree: 'B.S. Computer Engineering',
  gpa: '4.00',
  grad: 'May 2027',
  coursework: [
    'Control Systems',
    'Signals & Systems',
    'Microprocessors',
    'Data Communication Networks',
    'Computer Architecture',
    'Digital System Design',
    'Circuits I & II',
    'Electronics I',
    'Operating Systems I',
  ],
  honors: [
    'Shackouls Summer Research Fellowship',
    'ECE Design Showcase Honorable Mention',
    "President's List",
    'Colvard Future Leader Scholar',
    'Academic Excellence Scholarship',
  ],
};

// DIP-8 pinout: pins 1-4 run down the left side, 5-8 run up the right side.
export const pins = [
  { n: 1, name: 'SW', type: 'I/O', title: 'Software & scripting', items: ['C', 'C++', 'Python', 'PyQt6', 'JavaScript', 'MATLAB/Simulink', 'Bash', 'Git/GitHub', 'SQL/SQLite'] },
  { n: 2, name: 'CTRL', type: 'O', title: 'Controls & automation', items: ['Closed-loop PID control', 'Field-oriented control (FOC)', 'HMI configuration', 'Sensor integration', 'Real-time DAQ', 'Hardware-in-the-loop testing'] },
  { n: 3, name: 'ML', type: 'I', title: 'Data & machine learning', items: ['Computer vision (YOLO)', 'Signal processing', 'Edge deployment on NVIDIA Jetson'] },
  { n: 4, name: 'GND', type: 'PWR', title: 'Ground', items: ['Root-cause analysis: every fault traced back to its source'] },
  { n: 5, name: 'TEST', type: 'I', title: 'Instruments', items: ['Logic analyzers', 'Oscilloscopes', 'Multimeters'] },
  { n: 6, name: 'HW', type: 'I/O', title: 'Hardware platforms', items: ['ESP32', 'Arduino', 'ARM Cortex', 'Raspberry Pi', 'Jetson Orin Nano'] },
  { n: 7, name: 'COM', type: 'I/O', title: 'Protocols & networking', items: ['TCP/IP', 'UDP', 'RS-485', 'Modbus', 'SPI', 'I2C', 'UART', 'RF'] },
  { n: 8, name: 'VCC', type: 'PWR', title: 'Supply', items: ['Curiosity, regulated and always on'] },
];

// Dates are YYYY-MM. end: null means "present".
export const experience = [
  {
    id: 'hunter',
    org: 'Hunter Engineering Company',
    short: 'Hunter Engineering',
    role: 'Computer Engineering Co-op',
    place: 'Raymond, MS',
    start: '2026-08',
    end: null,
    bullets: [
      'Developed and maintained 6+ internal Python/PyQt6 tools for production and engineering teams, including an auto-updating ticketing app used by 100+ people and a rebuilt label-printing system with QR-code part tracking.',
      'Built MATLAB tools that check circuit-board solder quality from ERSA reflow oven thermal profiles, measuring heating rate, peak temperature and time above melting point, and flagging any profile outside solder paste limits.',
      'Built an HMI for a weight-based cable counting machine that shows operators part counts with a confidence score.',
      'Wrote operator work instructions and used root-cause analysis to fix recurring equipment issues and keep production running.',
    ],
  },
  {
    id: 'aai',
    org: 'Agricultural Autonomy Institute, Mississippi State University',
    short: 'Agricultural Autonomy Institute',
    role: 'Controls & Robotics Engineer Intern',
    place: 'Starkville, MS',
    start: '2026-02',
    end: '2026-07',
    bullets: [
      'Built a real-time C++/Python perception system that estimates sugarcane fill in a moving wagon by fusing LiDAR, depth camera and ultrasonic data, modeling pile shape from friction, angle of repose and geometry.',
      'Developed control logic that keeps an autonomous John Deere tractor in sync with a sugarcane harvester, using Kalman-filtered GPS data and closed-loop PID control of speed and acceleration.',
      'Integrated and calibrated LiDAR, ultrasonic, optical and GPS sensors with ESP32 and Arduino boards, and fixed sensor, TCP/IP and control issues during field tests.',
    ],
  },
  {
    id: 'cavs',
    org: 'Center for Advanced Vehicular Systems (CAVS), Mississippi State University',
    short: 'CAVS',
    role: 'Undergraduate Researcher',
    place: 'Starkville, MS',
    start: '2025-05',
    end: '2026-07',
    bullets: [
      'Developed a multimodal material-classification system for vehicle scrap sorting, training a YOLO model to separate wrought metal, sheet metal and non-metal materials.',
      'Built Python signal-processing and ML pipelines using acoustic and vibration data to classify materials and detect faults.',
      'Designed data-collection experiments and deployed optimized models on an NVIDIA Jetson Orin Nano for real-time inference.',
    ],
  },
  {
    id: 'powerhouse',
    org: 'PowerHouse Solar Greenhouse, Dept. of Mechanical Engineering, MSU',
    short: 'PowerHouse Solar Greenhouse',
    role: 'Undergraduate Researcher',
    place: 'Starkville, MS',
    start: '2025-02',
    end: '2026-01',
    bullets: [
      'Developed and calibrated servo-driven reflectors that redirect about 60% of targeted infrared light onto bifacial solar panels.',
      'Built an embedded data logger that records panel electrical output and environmental conditions over SPI and RS-485, with Python to collect, analyze and visualize system performance.',
    ],
  },
];

export const projects = [
  {
    id: 'pantilt',
    name: 'Pan-tilt motion-tracking camera',
    when: 'Aug 2026 – present',
    status: 'In progress',
    summary:
      'A 3D-printed pan-tilt camera that follows a moving subject. Two BLDC motors run field-oriented control on an ESP32-S3, with AS5600 magnetic encoders closing the loop for smooth, sub-degree positioning.',
    bom: [
      { ref: 'U1', qty: 1, part: 'ESP32-S3 microcontroller' },
      { ref: 'M1, M2', qty: 2, part: 'BLDC motor, FOC driven' },
      { ref: 'U2, U3', qty: 2, part: 'AS5600 magnetic encoder' },
      { ref: 'MECH1', qty: 1, part: '3D-printed pan-tilt frame' },
    ],
    photo: '',
  },
  {
    id: 'pavewatch',
    name: 'PaveWatch',
    when: 'Aug 2026 – present',
    status: 'Senior capstone',
    summary:
      'A drone-mounted sensor module for pavement inspection. A 2D LiDAR scanner and a downward-facing camera work together to find cracks, dips and surface damage on roads and sidewalks.',
    bom: [
      { ref: 'S1', qty: 1, part: '2D LiDAR scanner' },
      { ref: 'S2', qty: 1, part: 'Downward-facing camera' },
      { ref: 'A1', qty: 1, part: 'Drone platform and mount' },
    ],
    photo: '',
  },
];

export const leadership = {
  program: 'NSF Smart CT Program',
  role: 'Technical Mentor',
  when: 'Jun 2025 – Jul 2026',
  count: 8,
  detail:
    'Mentored high school students in microcontrollers, circuit wiring, sensor troubleshooting and technical documentation.',
};
