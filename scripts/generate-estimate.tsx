import {
  Document,
  Font,
  Page,
  Text,
  View,
  Svg,
  Path,
  Circle,
  renderToFile,
} from "@react-pdf/renderer";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Fonts ──

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fMZhrib2Bg-4.ttf",
      fontWeight: 500,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf",
      fontWeight: 600,
    },
  ],
});

Font.register({
  family: "Lora",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuyJGmKxemMeZ.ttf",
      fontWeight: 400,
      fontStyle: "italic",
    },
    {
      src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787z5vCJGmKxemMeZ.ttf",
      fontWeight: 500,
      fontStyle: "italic",
    },
  ],
});

// ── Data ──

const estimate = {
  number: "#PP-2026-001",
  date: "21 de abril de 2026",

  from: {
    name: "Anibal Ramos",
    email: "hello@parcelpin.com",
    web: "parcelpin.com",
  },

  client: {
    name: "Gabriel Scalise",
    role: "Cliente",
  },

  lineItems: [
    {
      name: "Terreno 1 — Visor 3D + Editor de lotes",
      description:
        "Visualización 3D interactiva con elevación real, lotes georreferenciados, simulación solar y panel de administración.",
      qty: 1,
      price: 700,
    },
    {
      name: "Terreno 2 — Visor 3D + Editor de lotes",
      description:
        "Visualización 3D interactiva con elevación real, lotes georreferenciados, simulación solar y panel de administración.",
      qty: 1,
      price: 700,
    },
    {
      name: "Terreno 3 — Visor 3D + Editor de lotes",
      description:
        "Visualización 3D interactiva con elevación real, lotes georreferenciados, simulación solar y panel de administración.",
      qty: 1,
      price: 700,
    },
    {
      name: "Terreno 4 — Visor 3D + Editor de lotes",
      description:
        "Visualización 3D interactiva con elevación real, lotes georreferenciados, simulación solar y panel de administración.",
      qty: 1,
      price: 700,
    },
    {
      name: "Terreno 5 — Visor 3D + Editor de lotes",
      description:
        "Visualización 3D interactiva con elevación real, lotes georreferenciados, simulación solar y panel de administración.",
      qty: 1,
      price: 700,
    },
  ],

  notes: [
    "Precio final por paquete de 5 proyectos. Sin impuestos adicionales ni comisiones.",
    "Cada proyecto incluye: Visor 3D interactivo con elevación real, lotes con estados editables (disponible/reservado/vendido), simulación solar diaria, fichas por lote, entrega en HTML5 compatible con todos los dispositivos, y editor de lotes.",
  ],
};

const subtotal = estimate.lineItems.reduce((s, li) => s + li.price * li.qty, 0);

// ── Helpers ──

function usd(amount: number) {
  return `USD ${amount.toLocaleString("en-US")}`;
}

// ── Styles ──

const c = {
  black: "#000",
  grey: "#666",
  light: "#999",
  rule: "#e0e0e0",
};

// ── Components ──

function LogoMark() {
  return (
    <Svg width={28} height={34} viewBox="0 0 40 48">
      <Path
        d="M20 4C11.716 4 6 9.923 6 17.888C6 28.241 14.106 34.685 20 44C25.894 34.685 34 28.241 34 17.888C34 9.923 28.284 4 20 4Z"
        stroke="#333"
        strokeWidth={1.6}
      />
      <Circle cx={27.4} cy={12.1} r={2.25} fill="#333" />
      <Path
        d="M12.6 20.2L20 16.3L27.4 20.2L20 24.4L12.6 20.2Z"
        fill="rgba(0,0,0,0.06)"
        stroke="#333"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
      <Path
        d="M16.35 18.25V22.15M20 16.3V24.4M23.65 18.25V22.15"
        stroke="#333"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Path
        d="M20 24.7V30.2"
        stroke="#333"
        strokeWidth={1.3}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function Divider({ style }: { style?: Record<string, unknown> }) {
  return (
    <View
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: c.rule,
        ...style,
      }}
    />
  );
}

// ── Template ──

function EstimateDocument() {
  return (
    <Document>
      <Page
        size="A4"
        style={{
          padding: 50,
          paddingBottom: 40,
          backgroundColor: "#fff",
          color: c.black,
          fontFamily: "Inter",
          fontWeight: 400,
        }}
      >
        {/* ── Header ── */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 40,
          }}
        >
          {/* Logo + wordmark */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LogoMark />
            <Text style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.3 }}>
              Parcel Pin
            </Text>
          </View>

          {/* Title + meta */}
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                fontFamily: "Lora",
                fontSize: 24,
                fontWeight: 400,
                fontStyle: "italic",
                marginBottom: 6,
              }}
            >
              Presupuesto
            </Text>
            <Text style={{ fontSize: 8.5, color: c.grey }}>{estimate.number}</Text>
            <Text style={{ fontSize: 8.5, color: c.grey, marginTop: 2 }}>
              {estimate.date}
            </Text>
          </View>
        </View>

        {/* ── From / Para ── */}
        <Divider style={{ marginBottom: 16 }} />

        <View style={{ flexDirection: "row", marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 8,
                fontWeight: 500,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: c.light,
                marginBottom: 8,
              }}
            >
              De
            </Text>
            <Text style={{ fontSize: 10, fontWeight: 500, marginBottom: 3 }}>
              {estimate.from.name}
            </Text>
            <Text style={{ fontSize: 9, color: c.grey, lineHeight: 1.6 }}>
              {estimate.from.email}
            </Text>
            <Text style={{ fontSize: 9, color: c.grey, lineHeight: 1.6 }}>
              {estimate.from.web}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 8,
                fontWeight: 500,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: c.light,
                marginBottom: 8,
              }}
            >
              Para
            </Text>
            <Text style={{ fontSize: 10, fontWeight: 500, marginBottom: 3 }}>
              {estimate.client.name}
            </Text>
            <Text style={{ fontSize: 9, color: c.grey, lineHeight: 1.6 }}>
              {estimate.client.role}
            </Text>
          </View>
        </View>

        <Divider style={{ marginBottom: 20 }} />

        {/* ── Line items table ── */}
        {/* Header row */}
        <View
          style={{
            flexDirection: "row",
            paddingBottom: 6,
            borderBottomWidth: 0.5,
            borderBottomColor: c.rule,
            marginBottom: 2,
          }}
        >
          <Text
            style={{
              flex: 5,
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: c.light,
            }}
          >
            Descripción
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: c.light,
              textAlign: "center",
            }}
          >
            Cant.
          </Text>
          <Text
            style={{
              flex: 1.5,
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: c.light,
              textAlign: "right",
            }}
          >
            Precio
          </Text>
          <Text
            style={{
              flex: 1.5,
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: c.light,
              textAlign: "right",
            }}
          >
            Total
          </Text>
        </View>

        {/* Data rows */}
        {estimate.lineItems.map((li, i) => (
          <View
            key={i}
            wrap={false}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              paddingVertical: 14,
              borderBottomWidth: 0.5,
              borderBottomColor: c.rule,
            }}
          >
            <View style={{ flex: 5, paddingRight: 16 }}>
              <Text style={{ fontSize: 9.5, fontWeight: 500, marginBottom: 3 }}>
                {li.name}
              </Text>
              <Text style={{ fontSize: 8, color: c.grey, lineHeight: 1.5 }}>
                {li.description}
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 9,
                textAlign: "center",
                paddingTop: 1,
              }}
            >
              {li.qty}
            </Text>
            <Text
              style={{
                flex: 1.5,
                fontSize: 9,
                textAlign: "right",
                paddingTop: 1,
              }}
            >
              {usd(li.price)}
            </Text>
            <Text
              style={{
                flex: 1.5,
                fontSize: 9,
                fontWeight: 500,
                textAlign: "right",
                paddingTop: 1,
              }}
            >
              {usd(li.price * li.qty)}
            </Text>
          </View>
        ))}

        {/* ── Summary ── */}
        <View
          style={{
            marginTop: 16,
            alignItems: "flex-end",
          }}
        >
          <View style={{ width: 220 }}>
            {/* Subtotal */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <Text style={{ fontSize: 9 }}>Subtotal (5 proyectos)</Text>
              <Text style={{ fontSize: 9 }}>{usd(subtotal)}</Text>
            </View>

            {/* Tax */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <Text style={{ fontSize: 9 }}>Impuestos</Text>
              <Text style={{ fontSize: 9 }}>—</Text>
            </View>

            {/* Total */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderTopWidth: 0.5,
                borderTopColor: c.black,
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: 500 }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: 600 }}>{usd(subtotal)}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
          }}
        >
          <Divider style={{ marginBottom: 14 }} />

          <Text
            style={{
              fontSize: 8,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: c.light,
              marginBottom: 8,
            }}
          >
            Notas
          </Text>

          {estimate.notes.map((note, i) => (
            <Text
              key={i}
              style={{
                fontSize: 8.5,
                color: c.grey,
                lineHeight: 1.6,
                marginBottom: 4,
              }}
            >
              {note}
            </Text>
          ))}

          {/* ── Footer ── */}
          <View
            style={{
              borderTopWidth: 0.5,
              borderTopColor: c.rule,
              paddingTop: 14,
              marginTop: 30,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 8, color: c.light }}>
              {estimate.from.name} · {estimate.from.email}
            </Text>
            <Text style={{ fontSize: 8, color: c.light }}>
              {estimate.from.web}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ── Generate ──

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(
    __dirname,
    "../downloads/presupuesto-gabriel-scalise.pdf",
  );

  await renderToFile(<EstimateDocument />, outPath);
  console.log(`✓ ${outPath}`);
}

main();
