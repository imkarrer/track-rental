export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-lg mb-4">RC Track Rental</h3>
            <p className="text-gray-600 text-sm">
              Rent RC car tracks and cars for your events
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/tracks" className="text-gray-600 hover:text-blue-600">
                  Tracks
                </a>
              </li>
              <li>
                <a href="/refund-policy" className="text-gray-600 hover:text-blue-600">
                  Refund Policy
                </a>
              </li>
              <li>
                <a href="/about" className="text-gray-600 hover:text-blue-600">
                  About
                </a>
              </li>
              <li>
                <a href="/contact" className="text-gray-600 hover:text-blue-600">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">Contact</h3>
            <p className="text-gray-600 text-sm">
              Email: info@rctrackrental.com
            </p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 text-center text-sm text-gray-600">
          <p>&copy; {new Date().getFullYear()} RC Track Rental. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

