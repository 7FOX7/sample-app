import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router} from 'react-router-dom'
import App from './App.jsx'
import { ThemeProvider } from '@mui/material'
import Typography from '@mui/material/Typography'
import theme from './theme/theme.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <ThemeProvider theme={theme}>
        <Typography variant="span" typography="mainContent">
          <App />
        </Typography>
      </ThemeProvider>
    </Router>
  </React.StrictMode>
)
