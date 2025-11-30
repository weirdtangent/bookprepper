import { Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HomePage from "./pages/HomePage";
import BookDetailPage from "./pages/BookDetailPage";
import SuggestPage from "./pages/SuggestPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/books/:slug" element={<BookDetailPage />} />
        <Route path="/suggest" element={<SuggestPage />} />
      </Route>
    </Routes>
  );
}

