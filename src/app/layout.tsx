// @ts-nocheck
import { MacalySandboxBridge } from '../../.sandbox/sandbox-bridge';
import React from "react";


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <MacalySandboxBridge><body>{children}</body></MacalySandboxBridge>
    </html>
  );
}
