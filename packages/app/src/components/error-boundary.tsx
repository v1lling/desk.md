
import { Component, ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface OwnProps {
  children: ReactNode;
}

type Props = OwnProps & WithTranslation;

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary component that catches React errors and displays a fallback UI.
 * Prevents the entire app from crashing when a single component fails.
 */
class ErrorBoundaryInner extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging (could be sent to error tracking service)
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { t } = this.props;

      return (
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="max-w-md text-center px-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>

            <h1 className="text-xl font-semibold mb-2">{t("errors.generic.unexpected.title")}</h1>

            <p className="text-muted-foreground mb-6">
              {t("errors.generic.unexpected.description")}
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-muted rounded-md text-left">
                <p className="text-sm font-mono text-muted-foreground break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleReset}>
                {t("common.buttons.tryAgain")}
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("common.buttons.reloadPage")}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);
