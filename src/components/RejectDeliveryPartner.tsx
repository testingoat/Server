import React, { useState } from 'react';
import { Box, Button, Text, MessageBox, Loader } from '@adminjs/design-system';
import { ActionProps, useNotice, ApiClient } from 'adminjs';

const RejectDeliveryPartner: React.FC<ActionProps> = (props) => {
  const { record, resource } = props;
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sendNotice = useNotice();
  const api = new ApiClient();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Validate rejection reason
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      setError('Rejection reason is required');
      return;
    }

    if (rejectionReason.trim().length < 10) {
      setError('Rejection reason must be at least 10 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call the reject action with the rejection reason
      const response = await api.recordAction({
        resourceId: resource.id,
        recordId: record.id,
        actionName: 'reject',
        data: {
          rejectionReason: rejectionReason.trim()
        }
      });

      if (response.data.notice) {
        sendNotice(response.data.notice);
      }

      // Redirect to list view
      if (response.data.redirectUrl) {
        window.location.href = response.data.redirectUrl;
      } else {
        window.location.href = `/admin/resources/${resource.id}/actions/list`;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject delivery partner');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    window.location.href = `/admin/resources/${resource.id}/actions/list`;
  };

  return (
    <Box variant="white" p="xxl">
      <Text fontSize="h4" mb="xl">
        Reject Delivery Partner: {record.params.name || record.params.email}
      </Text>

      <MessageBox variant="warning" mb="xl">
        <Text>
          You are about to reject this delivery partner application. 
          Please provide a detailed reason for rejection. This will be visible to the delivery partner.
        </Text>
      </MessageBox>

      {error && (
        <MessageBox variant="danger" mb="xl">
          <Text>{error}</Text>
        </MessageBox>
      )}

      <form onSubmit={handleSubmit}>
        <Box mb="xl">
          <Text fontSize="default" mb="sm" fontWeight="bold">
            Rejection Reason *
          </Text>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Enter detailed reason for rejection (minimum 10 characters)..."
            rows={6}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
            disabled={loading}
          />
          <Text fontSize="sm" color="grey60" mt="sm">
            Minimum 10 characters required
          </Text>
        </Box>

        <Box display="flex" gap="default">
          <Button
            type="submit"
            variant="danger"
            disabled={loading}
          >
            {loading ? <Loader /> : 'Reject Delivery Partner'}
          </Button>
          <Button
            type="button"
            variant="text"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </Box>
      </form>
    </Box>
  );
};

export default RejectDeliveryPartner;

