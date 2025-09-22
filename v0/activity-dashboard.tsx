"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, MapPin, Heart, Sparkles, DollarSign, Calendar, Star, Filter, Bell, User, Menu } from "lucide-react"

const recommendedSearches = [
  "Swimming lessons",
  "Art classes",
  "Soccer camps",
  "Music lessons",
  "Dance classes",
  "Coding workshops",
]

const newActivities = [
  {
    id: 1,
    title: "Creative Art Studio",
    location: "Downtown Arts Center",
    price: "$25/session",
    rating: 4.9,
    image: "/placeholder-4496q.png",
  },
  {
    id: 2,
    title: "Junior Chef Academy",
    location: "Culinary Institute",
    price: "$35/session",
    rating: 4.8,
    image: "/placeholder-eyf6a.png",
  },
  {
    id: 3,
    title: "Robot Building Workshop",
    location: "Tech Hub",
    price: "$40/session",
    rating: 4.9,
    image: "/placeholder-bxxbw.png",
  },
]

const budgetFriendlyActivities = [
  {
    id: 1,
    title: "Nature Scavenger Hunt",
    location: "Central Park",
    price: "Free",
    category: "Outdoor",
  },
  {
    id: 2,
    title: "Library Story Time",
    location: "Public Library",
    price: "Free",
    category: "Educational",
  },
  {
    id: 3,
    title: "Community Garden",
    location: "Green Valley",
    price: "$5/visit",
    category: "Nature",
  },
]

const activityTypes = [
  { name: "Sports", icon: "⚽", color: "bg-secondary" },
  { name: "Arts & Crafts", icon: "🎨", color: "bg-primary" },
  { name: "Music", icon: "🎵", color: "bg-accent" },
  { name: "Science", icon: "🔬", color: "bg-success" },
  { name: "Dance", icon: "💃", color: "bg-chart-5" },
  { name: "Outdoor", icon: "🌳", color: "bg-chart-4" },
]

const categories = [
  { name: "Age 3-5", count: 45, color: "bg-primary/10 text-primary" },
  { name: "Age 6-8", count: 62, color: "bg-secondary/10 text-secondary" },
  { name: "Age 9-12", count: 38, color: "bg-accent/10 text-accent-foreground" },
  { name: "Teens", count: 29, color: "bg-success/10 text-success-foreground" },
]

export function ActivityDashboard() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                KidsPlay
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-balance">{"Discover Amazing Activities for Your Kids! 🌟"}</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto text-pretty">
            Find the perfect activities to keep your children engaged, learning, and having fun
          </p>
        </div>

        {/* Search Bar */}
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
                <Input
                  placeholder="Search for activities, locations, or age groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <Button size="lg" className="px-8">
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
              <Button variant="outline" size="lg">
                <Filter className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recommended Searches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Recommended Searches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {recommendedSearches.map((search, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors px-4 py-2 text-sm"
                >
                  {search}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6 text-center">
              <MapPin className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-primary">Browse by Location</h3>
              <p className="text-sm text-muted-foreground mt-1">Find activities near you</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
            <CardContent className="p-6 text-center">
              <Heart className="h-8 w-8 text-secondary mx-auto mb-3" />
              <h3 className="font-semibold text-secondary">Favorites</h3>
              <p className="text-sm text-muted-foreground mt-1">Your saved activities</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <CardContent className="p-6 text-center">
              <DollarSign className="h-8 w-8 text-accent-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-accent-foreground">Budget Friendly</h3>
              <p className="text-sm text-muted-foreground mt-1">Affordable options</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardContent className="p-6 text-center">
              <Calendar className="h-8 w-8 text-success-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-success-foreground">New Activities</h3>
              <p className="text-sm text-muted-foreground mt-1">Latest additions</p>
            </CardContent>
          </Card>
        </div>

        {/* New Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-success" />
              New Activities This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {newActivities.map((activity) => (
                <Card key={activity.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="aspect-video relative">
                    <img
                      src={activity.image || "/placeholder.svg"}
                      alt={activity.title}
                      className="w-full h-full object-cover"
                    />
                    <Badge className="absolute top-2 right-2 bg-success text-success-foreground">New</Badge>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">{activity.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4" />
                      {activity.location}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">{activity.price}</span>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-accent text-accent" />
                        <span className="text-sm font-medium">{activity.rating}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Budget Friendly Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-accent" />
              Budget Friendly Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {budgetFriendlyActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div>
                    <h3 className="font-semibold">{activity.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {activity.location}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-success">{activity.price}</div>
                    <Badge variant="outline" className="text-xs">
                      {activity.category}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Browse by Activity Type */}
        <Card>
          <CardHeader>
            <CardTitle>Browse by Activity Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {activityTypes.map((type, index) => (
                <Card
                  key={index}
                  className={`cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 ${type.color}/10 border-current/20`}
                >
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl mb-3">{type.icon}</div>
                    <h3 className="font-semibold text-sm">{type.name}</h3>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Browse by Category (Age Groups) */}
        <Card>
          <CardHeader>
            <CardTitle>Browse by Age Group</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((category, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                >
                  <CardContent className="p-6 text-center">
                    <div
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${category.color} mb-3`}
                    >
                      <span className="font-bold text-lg">{category.name.split(" ")[1]}</span>
                    </div>
                    <h3 className="font-semibold">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.count} activities</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
