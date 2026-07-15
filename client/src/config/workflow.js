export const emptyItem = {
  itemId: "",
  name: "",
  requestedQty: 1,
  issuedQty: 0,
  serialNumber: "",
  purpose: "",
  unitCost: 0,
};

export const engineerStockItems = [
  { id: "NET-001", description: "UTP Network Cable CAT6" },
  { id: "FIB-001", description: "Fibre Optic Drop Cable" },
  { id: "RTR-001", description: "Network Router" },
];

export const serviceTypes = [
  ["new_installation", "New Installation"],
  ["reconnection", "Reconnection"],
  ["wifi_extension", "WiFi Extension"],
];
