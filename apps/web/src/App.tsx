import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import BookDetailPage from "./pages/BookDetailPage";
import SuggestPage from "./pages/SuggestPage";
import ConfigPage from "./pages/ConfigPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/books/:slug" element={<BookDetailPage />} />
        <Route path="/suggest" element={<SuggestPage />} />
        <Route path="/config" element={<ConfigPage />} />
      </Route>
    </Routes>
  );
}

