# Personal WhatsApp report sharing

WhatsApp Reports uses the shopkeeper's own WhatsApp account through the official `https://wa.me/{international-number}?text={encoded-message}` click-to-chat link. There is no Meta Cloud API integration, server-side token, sender Phone Number ID, API verification, or automatic message sending.

Each signed-in business stores its own number and report preferences in its business-scoped settings. Enter the local number in the phone field and choose its country code; if the entered value already includes that country prefix it is not added twice.

Daily reports are calculated from that business's invoices and cash-sale returns for the local calendar day. Demand messages use that business's regular demand records. WhatsApp opens with the generated message; the shopkeeper must review it and press Send.

The daily PDF is generated locally for download. Share PDF uses the device share sheet when file sharing is supported. The `wa.me` message does not attach PDFs. Daily reminders are browser/desktop notifications while Dukan Yantra is running; they open a prepared WhatsApp message and never send in the background.