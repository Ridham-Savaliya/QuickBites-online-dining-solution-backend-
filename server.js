import express from "express";
import cors from "cors";
import "dotenv/config";
import http from "http";
import { Server } from "socket.io"; // ✅ Correct named import
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import connectCloudinary from "./config/cloudinary.js";
import foodRouter from "./routes/foodRoute.js";
import restaurantRouter from "./routes/restaurantRoute.js";
import userRouter from "./routes/userRoute.js";
import cartRouter from "./routes/cartRoute.js";
import addressRouter from "./routes/addressRoute.js";
import orderRouter from "./routes/orderRoute.js";
import sellerRouter from "./routes/sellerRoute.js";
// import { Server } from 'socket.io'
import { AdminAuthRouter } from "./routes/adminAuthRoutes.js";
import adminRouter from "./routes/adminRoute.js";
import { DeliveryAgentModelRouter } from "./routes/deliveryAgentRoute.js";

// App config
const app = express();
const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: [
//       "http://localhost:5173",
//       "http://localhost:5174",
//       "http://localhost:5175",
//       "http://localhost:5176",
//       "http://localhost:5177",
//       "https://quick-bites-frontend-six.vercel.app",
//       "https://quickbites-admin-panel.vercel.app",
//       "https://quick-bites-seller.vercel.app",
//       "https://quick-bites-delivery.vercel.app",
//       "http://192.168.237.229:5173"
//     ],
//     methods: ['GET', 'POST'],
//     credentials: true,
//   },
// });

// ✅ Socket.IO with open CORS (allow everyone)
const io = new Server(server, {
  cors: {
    origin: "*",   // 👈 allow all origins
    methods: ["GET", "POST"],
    credentials: false, // 👈 disable credentials since "*" can't be combined with it
  },
});

// Port
const port = process.env.PORT || 4000;
connectDB();
connectCloudinary();

// Middlewares
// middlewares
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));


const deliveryNamespace = io.of('/track');

deliveryNamespace.on('connection', (socket) => {
  console.log('Client connected to /track');

  socket.on('joinRoom', (deliveryBoyId) => {
    socket.join(deliveryBoyId);
  });

  socket.on('locationUpdate', ({ deliveryBoyId, lat, lng,agentInfo }) => {
    deliveryNamespace.to(deliveryBoyId).emit('location', { lat, lng,agentInfo });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// const corsOptions = {
//   origin: function (origin, callback) {
//     console.log("Incoming Origin:", origin);
//     const allowed = [
//       "http://localhost:5173",
//       "http://localhost:5174",
//       "http://localhost:5175",
//       "http://localhost:5176",
//       "http://localhost:5177",
//       "https://quick-bites-frontend-six.vercel.app",
//       "https://quickbites-admin-panel.vercel.app",
//       "https://quick-bites-seller.vercel.app",
//       "https://quick-bites-delivery.vercel.app",
//       "http://192.168.237.229:5173"
//     ];
//     if (!origin || allowed.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS: " + origin));
//     }
//   },
//   credentials: true,
//   exposedHeaders: ["Authorization"],
// };

// app.use(cors(corsOptions));

// ✅ Open CORS for Express APIs too
app.use(cors({ origin: "*", credentials: false }));

// Routes
app.use("/api/food", foodRouter);
app.use("/api/restaurant", restaurantRouter);
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/address", addressRouter);
app.use("/api/order", orderRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/auth/admin", AdminAuthRouter);
app.use("/api/admin", adminRouter);
app.use("/api/delivery-agent", DeliveryAgentModelRouter);

// Socket.IO logic for location tracking
const deliveryLocations = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

socket.on('sendLocation', (data) => {
  const { deliveryAgentId, latitude, longitude,agentInfo } = data;
  deliveryLocations[deliveryAgentId] = { latitude, longitude};
  
  console.log(`🚀 Broadcasting location of ${deliveryAgentId}, ${latitude}, ${longitude},${agentInfo}`);
  
  // ✅ Log if emitting works
  console.log("📢 Emitting to all clients:", { deliveryAgentId, latitude, longitude, agentInfo });
  
  // Emit location update to all connected clients
  io.emit('locationUpdate', { deliveryAgentId, latitude, longitude,agentInfo });
});

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get("/healthcheck", (req, res) => {
  const now = new Date().toLocaleString();
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Quickbites Health Check</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #fef3c7, #fed7aa);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            color: #333;
          }
          .container {
            text-align: center;
            padding: 40px;
            background-color: #ffffffcc;
            border-radius: 20px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            animation: fadeIn 1s ease-in-out;
          }
          h1 {
            color: #f97316;
            margin-bottom: 20px;
          }
          p {
            font-size: 18px;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Quickbites Server is UP!</h1>
          <p>Current time: <strong>${now}</strong></p>
        </div>
      </body>
    </html>
  `);

  console.log('healthcheck route touched from https://quickbites-one.vercel.app at:',new Date().toLocaleString());
});



// Testing API
app.get("/", (req, res) => {
  res.send("Hello");
});

server.listen(port, () => console.log("Server running on port " + port));
