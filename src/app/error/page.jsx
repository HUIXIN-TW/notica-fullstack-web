"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessage = {
    OAuthSignin: "Error constructing the authorization URL. Check settings.",
    OAuthCallback: "Error handling the OAuth response. Try again.",
    OAuthCreateAccount: "Could not create account with Google credentials.",
    OAuthAccountNotLinked: "Email exists with a different sign-in method.",
    EmailCreateAccount: "Error creating account with email.",
    Callback: "Error during callback handling.",
    Configuration: "Server configuration error. Contact support.",
    AccessDenied: "Access denied. Contact admin.",
    Verification: "Email verification failed.",
    SessionRequired: "Please sign in to continue.",
    default: "Something went wrong during login. Please try again.",
  };

  const message = errorMessage[error] || errorMessage["default"];

  return (
    <div>
      {/* todo: padding issue */}
      <h2>⚠️ Login Error</h2>
      <p>{message}</p>
      <Link href="/">Return Home</Link>
    </div>
  );
}
