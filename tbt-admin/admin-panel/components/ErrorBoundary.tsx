"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/runtime errors in page content so a crash there can't take
 * the persistent Sidebar/Topbar nav down with it (DashboardLayout renders
 * both in the same tree as {children}, and this app has no route-level
 * error.tsx boundaries).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Page content crashed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#dc2626]/10 border border-[#dc2626]/20 flex items-center justify-center mb-5">
            <AlertTriangle size={24} className="text-[#dc2626]" />
          </div>
          <p className="text-[15px] font-semibold text-[#f0f0f0] mb-1.5">
            This page hit an error
          </p>
          <p className="text-[12px] text-[#606060] mb-6 max-w-sm">
            {this.state.error.message || "Something went wrong while loading this content."}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors"
          >
            <RotateCcw size={15} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
