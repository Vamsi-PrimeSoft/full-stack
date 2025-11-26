import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://192.168.20.196:4000";

export default function App() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const showMsg = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const loadProducts = async () => {
    const res = await fetch(`${API_BASE}/api/products`);
    const data = await res.json();
    setProducts(data);
  };

  const loadCart = async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/cart`, {
      headers: authHeaders
    });
    if (res.ok) {
      const data = await res.json();
      setCart(data.items || []);
    }
  };

  const loadOrders = async () => {
    if (!token) return;
    const res = await fetch(`${API_BASE}/api/orders`, {
      headers: authHeaders
    });
    if (res.ok) {
      const data = await res.json();
      setOrders(data);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadCart();
    loadOrders();
  }, [token]);

  const handleRegister = async () => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      showMsg("Registered. Now login.");
    } else {
      const err = await res.json();
      showMsg(err.message || "Registration failed");
    }
  };

  const handleLogin = async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      showMsg("Logged in");
    } else {
      const err = await res.json();
      showMsg(err.message || "Login failed");
    }
  };

  const addToCart = async (productId) => {
    const res = await fetch(`${API_BASE}/api/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders
      },
      body: JSON.stringify({ productId, quantity: 1 })
    });
    const data = await res.json();
    if (res.ok) {
      setCart(data.items || []);
      showMsg("Added to cart");
    } else {
      showMsg(data.message || "Error adding to cart");
    }
  };

  const createOrder = async () => {
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: "POST",
      headers: authHeaders
    });
    const data = await res.json();
    if (res.ok) {
      showMsg("Order created");
      setOrders((prev) => [...prev, data]);
      loadCart();
    } else {
      showMsg(data.message || "Error creating order");
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h1>ShopSphere (Microservices Demo on ECS-style layout)</h1>

      {message && (
        <div
          style={{
            padding: 10,
            marginBottom: 10,
            border: "1px solid #ccc",
            background: "#f9f9f9"
          }}
        >
          {message}
        </div>
      )}

      <section style={{ marginBottom: 20 }}>
        <h2>Auth</h2>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button onClick={handleRegister} style={{ marginRight: 8 }}>
          Register
        </button>
        <button onClick={handleLogin}>Login</button>
        {token && (
          <div style={{ marginTop: 8 }}>
            <small>Token set (truncated): {token.slice(0, 20)}...</small>
          </div>
        )}
      </section>

      <section style={{ marginBottom: 20 }}>
        <h2>Products</h2>
        <ul>
          {products.map((p) => (
            <li key={p.id}>
              {p.name} - ₹{p.price} ({p.stock} in stock)
              {token && (
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => addToCart(p.id)}
                >
                  Add to cart
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {token && (
        <>
          <section style={{ marginBottom: 20 }}>
            <h2>Cart</h2>
            {cart.length === 0 ? (
              <p>Cart is empty</p>
            ) : (
              <ul>
                {cart.map((item, idx) => (
                  <li key={idx}>
                    Product ID: {item.productId}, Qty: {item.quantity}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={createOrder} disabled={cart.length === 0}>
              Place order
            </button>
          </section>

          <section>
            <h2>Orders</h2>
            {orders.length === 0 ? (
              <p>No orders yet</p>
            ) : (
              <ul>
                {orders.map((o) => (
                  <li key={o.id}>
                    Order #{o.id} - Status: {o.status} - Total: ₹{o.total}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
