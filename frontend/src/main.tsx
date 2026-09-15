import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/typography.css'
import App from './App.tsx'
import { UiStateProvider } from './state/uiState.tsx'
import { MapDrawingProvider } from './features/map/mapDrawing.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UiStateProvider>
        <MapDrawingProvider>
          <App />
        </MapDrawingProvider>
      </UiStateProvider>
    </QueryClientProvider>
  </StrictMode>,
)
