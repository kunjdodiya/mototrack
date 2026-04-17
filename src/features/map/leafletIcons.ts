import L from 'leaflet'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

/**
 * Leaflet's default marker icon uses relative image paths that Vite does not
 * rewrite. Import the images as URLs ourselves and rebind the default.
 * Must be imported once at app boot.
 */
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
})
