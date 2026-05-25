const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const CONSUMER_KEY    = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const SHORTCODE       = process.env.SHORTCODE || "9248314";
const PASSKEY         = process.env.PASSKEY   || "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
const CALLBACK_URL    = process.env.CALLBACK_URL;
const BASE_URL        = "https://api.safaricom.co.ke";

async function getAccessToken() {
  const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const res = await axios.get(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return res.data.access_token;
}

 app.get("/stkpush", async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: "Phone and amount are required." });
     const formattedPhone = phone.startsWith("254") ? phone : "254" + phone.replace(/^0/, "");

  try {
    const token     = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const password  = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password:          password,
      Timestamp:         timestamp,
      TransactionType:   "CustomerPayBillOnline",
      Amount:            Math.ceil(Number(amount)),
      PartyA:            formattedPhone,
      PartyB:            SHORTCODE,
      PhoneNumber:       formattedPhone,
      CallBackURL:       CALLBACK_URL,
      AccountReference:  "JoabAirtimeHub",
      TransactionDesc:   "Airtime Purchase",
    };

    const response = await axios.post(
      `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.json({ success: true, message: "STK Push sent! Check your phone.", CheckoutRequestID: response.data.CheckoutRequestID });

  } catch (err) {
    console.error("STK Push Error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to initiate payment.", details: err.response?.data || err.message });
  }
});

app.post("/callback", (req, res) => {
  const body = req.body?.Body?.stkCallback;
  if (!body) return res.status(400).send("Invalid callback");
  const { ResultCode, ResultDesc, CallbackMetadata } = body;
  if (ResultCode === 0) {
    const items    = CallbackMetadata?.Item || [];
    const amount   = items.find(i => i.Name === "Amount")?.Value;
    const mpesaRef = items.find(i => i.Name === "MpesaReceiptNumber")?.Value;
    const phone    = items.find(i => i.Name === "PhoneNumber")?.Value;
    console.log(`✅ Payment SUCCESS | KES ${amount} | Ref: ${mpesaRef} | Phone: ${phone}`);
  } else {
    console.log(`❌ Payment FAILED | ${ResultDesc}`);
  }
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

app.get("/", (req, res) => res.send("Joab Airtime Hub Backend ✅ Running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
