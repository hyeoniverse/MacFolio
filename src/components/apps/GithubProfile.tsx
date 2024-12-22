import React from 'react';

const GithubProfile: React.FC = () => {
  return (
    <div>
      {/* HEADER */}
      <div className="header">
        <img
          src="https://capsule-render.vercel.app/api?type=waving&color=0:724cf9,20:754ef9,100:c77bf9&height=300&section=header&text=Coding%20Kirby🌌&fontSize=90&fontColor=ffffff&rotate=-5&desc=App%20Developer&descAlign=15&descAlignY=30&animation=fadeIn"
          style={{ width: "100%" }}
          alt="header"
        />
        <img
          src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2FCodingKirby&count_bg=%23B370F9&title_bg=%23724CF9&icon=github.svg&icon_color=%23FFFFFF&title=hits&edge_for-the-badge=false"
          alt="hits"
          style={{ 
            margin: "1rem",
           }}
        />
      </div>

      {/* TYPING CARD */}
      <a href="https://git.io/typing-svg" target="_blank" rel="noopener noreferrer">
        <img
          src="https://readme-typing-svg.demolab.com?font=Pacifico&size=50&pause=1000&color=B196FB&center=true&vCenter=true&width=1000&height=100&lines=Hi+there+👋+I'm+KimJeongHyeon"
          alt="Typing SVG"
          style={{ width: "100%" }}
        />
      </a>

      {/* GitHub Stats & Languages */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "1rem",
          margin: "2rem"
        }}
      >
        <img
          src="https://github-readme-stats-one-alpha.vercel.app/api/top-langs/?username=CodingKirby&layout=compact&title_color=724cf9&text_color=724cf9&icon_color=724cf9&bg_color=ffffff&hide_border=true&include_all_commits=true&count_private=true"
          style={{ width: "40%" }}
          alt="Top Languages"
        />
        <img
          src="https://github-readme-stats-one-alpha.vercel.app/api?username=CodingKirby&show_icons=true&title_color=ffffff&text_color=ffffff&icon_color=ffffff&bg_color=35,724cf9,b196fb,b370f9&include_all_commits=true&count_private=true&custom_title=CodingKirby's%20GitHub%20Report"
          style={{ width: "50%" }}
          alt="GitHub Stats"
        />
      </div>

      {/* SKILLS */}
      <h2>🛠 SKILLS 🛠</h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap", // 아이템들이 영역을 넘어갈 때 다음 줄로 넘기기
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <img src="https://img.shields.io/badge/Swift-F05138?style=for-the-badge&logo=swift&logoColor=white" height="25rem" alt="Swift" />
          <img src="https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54" height="25rem" alt="Python" />
          <img src="https://img.shields.io/badge/Java-F7DF1E?style=for-the-badge&logo=java&logoColor=white" height="25rem" alt="Java" />
          <img src="https://img.shields.io/badge/C%23-A8B9CC?style=for-the-badge&logo=c%23&logoColor=white" height="25rem" alt="C#" />
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <img src="https://img.shields.io/badge/html5-E34F26.svg?style=for-the-badge&logo=html5&logoColor=white" height="25rem" alt="HTML5" />
          <img src="https://img.shields.io/badge/CSS3-1572B6.svg?style=for-the-badge&logo=css3&logoColor=white" height="25rem" alt="CSS3" />
          <img src="https://img.shields.io/badge/javascript-F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=20232a" height="25rem" alt="JavaScript" />
          <img src="https://img.shields.io/badge/Firebase-DD2C00.svg?style=for-the-badge&logo=firebase&logoColor=white" height="25rem" alt="Firebase" />
          <img src="https://img.shields.io/badge/MySQL-4479A1.svg?style=for-the-badge&logo=mysql&logoColor=white" height="25rem" alt="MySQL" />
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <img src="https://img.shields.io/badge/github-181717.svg?style=for-the-badge&logo=github&logoColor=white" height="25rem" alt="GitHub" />
          <img src="https://img.shields.io/badge/Notion-F3F3F3.svg?style=for-the-badge&logo=notion&logoColor=black" height="25rem" alt="Notion" />
        </div>
      </div>
      

      {/* FOOTER */}
      <div >
        <img src="https://capsule-render.vercel.app/api?type=waving&color=0:724cf9,20:754ef9,100:c77bf9&height=120&section=footer" width="100%" alt="footer" />
      </div>
    </div>
  );
};

export default GithubProfile;
