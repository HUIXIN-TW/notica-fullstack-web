import "../styles/global.css";
import Provider from "@components/provider/Provider";
import TopNavBar from "@components/topnavbar/TopNavBar";
import Footer from "@components/footer/Footer";

export const metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://notica.studio",
  ),
  applicationName: "Notica Studio",
  title: {
    default: "Notica Studio",
    template: "%s | Notica Studio",
  },
  description:
    "Notica Studio helps you sync selected Google Calendar events into your Notion database with a focused, privacy-conscious workflow.",
  keywords: [
    "Notica Studio",
    "Google Calendar",
    "Notion",
    "calendar sync",
    "Notion integration",
  ],
  authors: [{ name: "Huixin Yang" }],
  creator: "Huixin Yang",
  publisher: "Notica Studio",
  openGraph: {
    title: "Notica Studio",
    description:
      "Sync selected Google Calendar events into your Notion database with clear setup and focused controls.",
    siteName: "Notica Studio",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Notica Studio",
    description:
      "Sync selected Google Calendar events into your Notion database with clear setup and focused controls.",
  },
  icons: {
    icon: "/assets/images/notica.png",
    apple: "/assets/images/notica.png",
    shortcut: "/assets/images/notica.png",
  },
};

const RootLayout = ({ children }) => (
  <html lang="en">
    <body>
      <div className="gradient-layer" />
      <div className="content-layer">
        <Provider>
          <div className="top-section">
            <TopNavBar />
          </div>
          <div className="main-section">
            <main>{children}</main>
          </div>
          <div className="footer-section">
            <Footer />
          </div>
        </Provider>
      </div>
    </body>
  </html>
);

export default RootLayout;
