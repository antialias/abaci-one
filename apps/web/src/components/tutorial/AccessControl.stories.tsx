import type { Meta, StoryObj } from "@storybook/react";
import {
  DevAccessProvider,
  useEditorAccess,
} from "../../hooks/useAccessControl";

// Simple component that tests access control
function AccessControlDisplay() {
  const access = useEditorAccess();

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h2>Access Control Test</h2>
      <div>
        <strong>Can Access Editor:</strong>{" "}
        {access.canAccessEditor ? "Yes" : "No"}
      </div>
      <div>
        <strong>Can Edit Tutorials:</strong>{" "}
        {access.canEditTutorials ? "Yes" : "No"}
      </div>
      <div>
        <strong>Can Publish:</strong>{" "}
        {access.canPublishTutorials ? "Yes" : "No"}
      </div>
      <div>
        <strong>Can Delete:</strong> {access.canDeleteTutorials ? "Yes" : "No"}
      </div>
      {access.reason && (
        <div>
          <strong>Reason:</strong> {access.reason}
        </div>
      )}
    </div>
  );
}

function AccessControlWithProvider() {
  return (
    <DevAccessProvider>
      <AccessControlDisplay />
    </DevAccessProvider>
  );
}

const meta: Meta<typeof AccessControlWithProvider> = {
  title: "Debug/AccessControl",
  component: AccessControlWithProvider,
  parameters: {
    docs: {
      description: {
        component: "Test the access control hook in isolation",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AccessControlWithProvider>;

export const WithDevAccess: Story = {};

// Test without provider to see if that causes issues
export const WithoutProvider: Story = {
  render: () => <AccessControlDisplay />,
};
