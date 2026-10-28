window.DEFAULT_SITE_CONTENT = {
  videos: [
    {
      file: "video/SHOT VIDEOS A.mp4",
      thumbnail: "video-thumbnails/shot-videos-a.jpg",
      title: "Shot Videos A",
      description: "A collection of moving images with sharp composition and a dynamic visual rhythm.",
      category: "Showreel"
    },
    {
      file: "video/SHOT VIDEOS B.mp4",
      thumbnail: "video-thumbnails/shot-videos-b.jpg",
      title: "Shot Videos B",
      description: "An exploration of camera angles that captures moments with a strong point of view.",
      category: "Showreel"
    },
    {
      file: "video/PERSONAL PROJECT.mp4",
      thumbnail: "video-thumbnails/personal-project.jpg",
      title: "Personal Project",
      description: "A personal project exploring new ideas, moods, and visual languages.",
      category: "Personal Work"
    },
    {
      file: "video/ CINEMATIC CAR.mp4",
      thumbnail: "video-thumbnails/cinematic-car.jpg",
      title: "Cinematic Car",
      description: "A cinematic study of shape, light reflections, and the movement of a vehicle.",
      category: "Cinematic"
    },
    {
      file: "video/FILM PENDEK.mp4",
      thumbnail: "video-thumbnails/film-pendek.jpg",
      title: "Short Film",
      description: "A short story shaped through atmosphere, carefully edited shots, and relatable emotion.",
      category: "Short Film"
    },
    {
      file: "video/CINEMATIC VISUALS.mp4",
      thumbnail: "video-thumbnails/cinematic-visuals.jpg",
      title: "Cinematic Visuals",
      description: "An atmospheric visual collection focused on light, color, and image detail.",
      category: "Cinematic"
    },
    {
      file: "video/CINEMATIC SHOTS.mp4",
      thumbnail: "video-thumbnails/cinematic-shots.jpg",
      title: "Cinematic Shots",
      description: "Cinematic shots that bring spaces, movement, and moments into closer focus.",
      category: "Cinematic"
    }
  ],
  designs: [
    ...Array.from({ length: 17 }, (_, index) => {
      const number = index + 1 + (index >= 2 ? 1 : 0);
      return {
        title: `Party Flyer ${number}`,
        image: `../hamanan 2/party flyer/party flyer${number}.jpg`,
        thumbnail: `poster-thumbnails/party-${number}.jpg`,
        category: "Party"
      };
    }),
    ...Array.from({ length: 10 }, (_, index) => ({
      title: `Promotional Flyer ${index + 1}`,
      image: `../hamanan 2/Promotional Flyer/Promotional Flyer${index + 1}.jpg`,
      thumbnail: `poster-thumbnails/promotion-${index + 1}.jpg`,
      category: "Promotion"
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
      title: `Sports Flyer ${index + 1}`,
      image: `../hamanan 2/Sports Flyer/Sports Flyer${index + 1}.jpg`,
      thumbnail: `poster-thumbnails/sports-${index + 1}.jpg`,
      category: "Sports"
    }))
  ]
};
