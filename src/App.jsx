import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ConnectionProblem from '@/components/ConnectionProblem';
import Login from './pages/Login';
import SetNewPassword from './pages/SetNewPassword';
import Dashboard from './pages/Dashboard';
import Layout from './Layout';

// Each page is loaded the first time it is opened, which keeps the first
// visit fast on phones. (Once installed, every page is saved for offline use.)
const AddItem = lazy(() => import('./pages/AddItem'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Search = lazy(() => import('./pages/Search'));
const ManageLocations = lazy(() => import('./pages/ManageLocations'));
const ItemDetails = lazy(() => import('./pages/ItemDetails'));
const PrintView = lazy(() => import('./pages/PrintView'));
const BorrowedItems = lazy(() => import('./pages/BorrowedItems'));
const Locations = lazy(() => import('./pages/Locations'));
const ManageCategories = lazy(() => import('./pages/ManageCategories'));
const Settings = lazy(() => import('./pages/Settings'));
const Administration = lazy(() => import('./pages/Administration'));
const ExpendableItems = lazy(() => import('./pages/ExpendableItems'));
const InventoryList = lazy(() => import('./pages/InventoryList'));
const PrintHangTags = lazy(() => import('./pages/PrintHangTags'));
const RentalsDashboard = lazy(() => import('./pages/RentalsDashboard'));
const RentalOrderEditor = lazy(() => import('./pages/RentalOrderEditor'));
const PrintQuote = lazy(() => import('./pages/PrintQuote'));
const InvoiceDetails = lazy(() => import('./pages/InvoiceDetails'));
const PrintInvoice = lazy(() => import('./pages/PrintInvoice'));
const LocationViewer = lazy(() => import('./pages/LocationViewer'));
const RemindersManager = lazy(() => import('./pages/RemindersManager'));

const PageLoading = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-base-100">
    <div className="w-8 h-8 border-4 border-base-300 border-t-primary rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { status, authError, isRecoveringPassword, sessionVersion, checkAppState } = useAuth();

  if (status === 'loading') {
    return <PageLoading />;
  }

  if (status === 'error') {
    return <ConnectionProblem message={authError?.message} onRetry={checkAppState} />;
  }

  if (status === 'signedOut') {
    return <Login />;
  }

  if (isRecoveringPassword) {
    return <SetNewPassword />;
  }

  // `key` makes every screen start fresh when a different person signs in.
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes key={sessionVersion}>
      <Route path="/" element={<Layout currentPageName="Dashboard"><Dashboard /></Layout>} />
      <Route path="/Dashboard" element={<Layout currentPageName="Dashboard"><Dashboard /></Layout>} />
      <Route path="/AddItem" element={<Layout currentPageName="Inventory"><AddItem /></Layout>} />
      <Route path="/Inventory" element={<Layout currentPageName="Inventory"><Inventory /></Layout>} />
      <Route path="/Search" element={<Layout currentPageName="Search"><Search /></Layout>} />
      <Route path="/ManageLocations" element={<Layout currentPageName="Manage Locations"><ManageLocations /></Layout>} />
      <Route path="/ItemDetails" element={<Layout currentPageName="Inventory"><ItemDetails /></Layout>} />
      <Route path="/PrintView" element={<Layout currentPageName="PrintView"><PrintView /></Layout>} />
      <Route path="/BorrowedItems" element={<Layout currentPageName="Borrowed Items"><BorrowedItems /></Layout>} />
      <Route path="/Locations" element={<Layout currentPageName="Manage Locations"><Locations /></Layout>} />
      <Route path="/ManageCategories" element={<Layout currentPageName="Inventory"><ManageCategories /></Layout>} />
      <Route path="/Settings" element={<Layout currentPageName="Settings"><Settings /></Layout>} />
      <Route path="/Administration" element={<Layout currentPageName="Administration"><Administration /></Layout>} />
      <Route path="/ExpendableItems" element={<Layout currentPageName="Inventory"><ExpendableItems /></Layout>} />
      <Route path="/InventoryList" element={<Layout currentPageName="Inventory List"><InventoryList /></Layout>} />
      <Route path="/PrintHangTags" element={<Layout currentPageName="PrintHangTags"><PrintHangTags /></Layout>} />
      <Route path="/RentalsDashboard" element={<Layout currentPageName="Rentals"><RentalsDashboard /></Layout>} />
      <Route path="/RentalOrderEditor" element={<Layout currentPageName="Rentals"><RentalOrderEditor /></Layout>} />
      <Route path="/PrintQuote" element={<Layout currentPageName="PrintQuote"><PrintQuote /></Layout>} />
      <Route path="/InvoiceDetails" element={<Layout currentPageName="Rentals"><InvoiceDetails /></Layout>} />
      <Route path="/PrintInvoice" element={<Layout currentPageName="PrintInvoice"><PrintInvoice /></Layout>} />
      <Route path="/LocationViewer" element={<Layout currentPageName="Manage Locations"><LocationViewer /></Layout>} />
      <Route path="/RemindersManager" element={<Layout currentPageName="Reminders"><RemindersManager /></Layout>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
