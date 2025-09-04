@@ .. @@
   extractCompetitionMap(data: any): Map<string, string> {
     const competitionMap = new Map<string, string>();
     
     try {
       if (!data.competitionData) {
         console.warn('⚠️ No competitionData found in API response');
         return competitionMap;
       }
       
       console.log('📋 Raw competitionData from API:', data.competitionData);
       
       // Parse the pipe-delimited competition data
       const competitions = data.competitionData.split('|').filter((comp: string) => comp.trim());
       
       console.log(`🔍 Found ${competitions.length} competition entries`);
       
       competitions.forEach((competition: string, index: number) => {
         const fields = competition.split(';');
         
         if (fields.length >= 2) {
           const id = fields[0]?.trim();
           const name = fields[1]?.trim();
           
           if (id && name && !isNaN(parseInt(id))) {
             competitionMap.set(id, name);
-            console.log(`   ${index + 1}. Competition ${id} → "${name}"`);
+            console.log(`   ${index + 1}. Competition ${id} → "${name}" (from API)`);
           }
         }
       });
       
       console.log(`✅ Extracted ${competitionMap.size} competition names from API`);
       
     } catch (error) {
       console.error('❌ Error parsing competition data:', error);
     }
     
     return competitionMap;
   }