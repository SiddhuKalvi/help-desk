import { Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage.tsx'
import HomePage from './pages/HomePage.tsx'
import TicketsPage from './pages/TicketsPage.tsx'
import TicketDetailPage from './pages/TicketDetailPage.tsx'
import UsersPage from './pages/UsersPage.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import RequireAdmin from './components/RequireAdmin.tsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route element={<RequireAdmin />}>
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
