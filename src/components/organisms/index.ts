export { ChatPanel } from './chat/ChatPanel';
export { AiResponsePreview } from './copilot/AiResponsePreview';
export { ConversationInbox } from './inbox/ConversationInbox';
export { ContextSidebar } from './context/ContextSidebar';
export { CustomerContextPanel } from './context/CustomerContextPanel';
export { AgentWorkspace } from './workspace/AgentWorkspace';

// Master Data Order Components
export { ConfirmModal, type ConfirmModalProps } from './ConfirmModal/ConfirmModal';
export { OrderTable } from './Order/OrderTable';
export { OrderFilterBar } from './Order/OrderFilterBar';
export { OrderGeneralTab } from './Order/OrderGeneralTab';
export { OrderItemsTab } from './Order/OrderItemsTab';
export { OrderStatusHistoryTab } from './Order/OrderStatusHistoryTab';
export { OrderShippingFinancialTab } from './Order/OrderShippingFinancialTab';
export {
  OrderDetailContent,
  type OrderDetailContentProps,
  type OrderTabKey,
} from './Order/OrderDetailContent';
export {
  OrderQuickViewModal,
  type OrderQuickViewModalProps,
} from './Order/OrderQuickViewModal';
export { OrderForm } from './OrderForm/OrderForm';

// Order SubModals
export {
  UpdateOrderStatusModal,
  type UpdateOrderStatusModalProps,
} from './Order/SubModals/UpdateOrderStatusModal';
export {
  UpdateOrderGeneralModal,
  type UpdateOrderGeneralModalProps,
} from './Order/SubModals/UpdateOrderGeneralModal';
export {
  UpdateOrderShippingModal,
  type UpdateOrderShippingModalProps,
} from './Order/SubModals/UpdateOrderShippingModal';
export {
  AddOrderItemModal,
  type AddOrderItemModalProps,
} from './Order/SubModals/AddOrderItemModal';

// Master Data Customer 360 Components
export { CustomerFilterBar } from './Customer/CustomerFilterBar';
export { CustomerTable } from './Customer/CustomerTable';
export {
  CustomerDossierHeader,
  type CustomerDossierHeaderProps,
} from './Customer/CustomerDossierHeader';
export { CustomerMetricsGrid } from './Customer/CustomerMetricsGrid';
export {
  CustomerOrdersTab,
  type CustomerOrdersTabProps,
} from './Customer/CustomerOrdersTab';
export { CustomerConversationsTab } from './Customer/CustomerConversationsTab';
export { CustomerEvidencesTab } from './Customer/CustomerEvidencesTab';
export {
  CustomerDetailContent,
  type CustomerDetailContentProps,
  type CustomerTabKey,
} from './Customer/CustomerDetailContent';
export {
  CustomerQuickViewModal,
  type CustomerQuickViewModalProps,
} from './Customer/CustomerQuickViewModal';
export {
  UpdateCustomerModal,
  type UpdateCustomerModalProps,
} from './Customer/UpdateCustomerModal';

// Channel Integrations
export * from './Integrations';
