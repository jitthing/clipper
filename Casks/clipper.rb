cask "clipper" do
  version "0.4.5"
  sha256 "5e68b7bcc74ab0e103d1861e97766afd968fd642d40e9518fa45eb6e9b22ac83"

  url "https://github.com/jitthing/clipper/releases/download/v#{version}/Clipper_0.1.0_aarch64.dmg"
  name "Clipper"
  desc "Screenshot tool with smart window detection and inline annotations"
  homepage "https://github.com/jitthing/clipper"

  depends_on macos: ">= :ventura"

  app "Clipper.app"

  zap trash: [
    "~/Library/Application Support/com.clipper.app",
    "~/Library/Preferences/com.clipper.app.plist",
  ]
end
